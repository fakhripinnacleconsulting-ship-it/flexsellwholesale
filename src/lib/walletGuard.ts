import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import dbConnect from "./dbConnect";
import Manager from "@/models/Manager";
import Customer from "@/models/Customer";
import { getTokenFromCookie, verifyToken } from "./auth";
import { resolveActor } from "./orderHistory";
import { WALLET_PERMISSIONS, type WalletType } from "./walletConstants";
import type { WalletActor } from "@/types/wallet";

interface SessionPayload {
  userId: string;
  email?: string;
  role: string;
}

interface GuardSuccess {
  payload: SessionPayload;
  actor: WalletActor;
  error?: never;
}
interface GuardFailure {
  payload?: never;
  actor?: never;
  error: NextResponse;
}
type GuardResult = GuardSuccess | GuardFailure;

const unauthorised = (message: string, status: number): GuardFailure => ({
  error: NextResponse.json({ message }, { status }),
});

async function readSession(): Promise<SessionPayload | null> {
  const token = await getTokenFromCookie();
  if (!token) return null;
  const payload = verifyToken(token);
  return payload ? (payload as SessionPayload) : null;
}

/**
 * Authorises a staff wallet write and returns the actor to attribute it to.
 *
 * Deliberately **not** built on `verifyManagerOrderAccess`. That helper ends with
 *
 *     if (hasPerm("ops_shipping") || hasPerm("orders")) allowed = true;
 *
 * which is a sensible convenience for shipping and unacceptable for money: a manager
 * granted shipping access would inherit the ability to spend a customer's balance. Here
 * the only thing that grants access is the exact permission for the wallet being written.
 *
 * The permission is derived from `walletType`, never from the request body, so a
 * `wallet_business` holder cannot reach a Store Wallet by changing a field in the payload.
 *
 * Returns the actor alongside the session because every ledger entry must record who wrote
 * it (§4.4), and the manager document is already loaded here for the permission check.
 */
export async function requireWalletSpendAccess(walletType: WalletType): Promise<GuardResult> {
  try {
    const payload = await readSession();
    if (!payload) return unauthorised("Not authenticated", 401);

    if (payload.role === "admin") {
      return { payload, actor: resolveActor(payload) as WalletActor };
    }

    if (payload.role === "manager") {
      await dbConnect();
      const manager = await Manager.findById(payload.userId).select("name status permissions").lean() as
        | { name?: string; status?: string; permissions?: string[] }
        | null;

      if (!manager || manager.status !== "active") {
        return unauthorised("Forbidden: Manager account suspended or inactive", 403);
      }

      const required = WALLET_PERMISSIONS[walletType];
      // Exact match only. No root-permission widening, no wildcard, no fallback — the
      // widening in requireAdminOrManagerAuth exists so "orders" implies "orders:update",
      // and there is no equivalent shorthand that should imply "may spend someone's money".
      if (!(manager.permissions || []).includes(required)) {
        return unauthorised("Forbidden: Wallet permission required", 403);
      }

      return { payload, actor: resolveActor(payload, manager.name) as WalletActor };
    }

    return unauthorised("Forbidden: Staff access required", 403);
  } catch {
    return unauthorised("Auth validation error", 401);
  }
}

/**
 * Authorises an admin-only wallet action — the ones that create, return or move money.
 *
 * Managers are excluded outright rather than by permission: offline credit, refund,
 * reversal, transfer and closure have no gateway confirming them, so they are not
 * delegable at all.
 */
export async function requireWalletAdmin(): Promise<GuardResult> {
  try {
    const payload = await readSession();
    if (!payload) return unauthorised("Not authenticated", 401);
    if (payload.role !== "admin") return unauthorised("Forbidden: Admin privileges required", 403);
    return { payload, actor: resolveActor(payload) as WalletActor };
  } catch {
    return unauthorised("Auth validation error", 401);
  }
}

/**
 * Re-verifies the acting admin's password, inside the request that moves the money.
 *
 * Admins are `Customer` documents with `role: "admin"` and a bcrypt password, so this
 * reuses the same comparison the login route performs.
 *
 * There is deliberately no grace window and no separate `/verify-password` endpoint: a
 * five-minute pass would make the *second* large transfer free, which is precisely the one
 * worth stopping, and a separate endpoint would reduce the check to a boolean the client
 * asserts on its own behalf.
 */
export async function verifyAdminPassword(
  userId: string,
  password: unknown
): Promise<{ ok: true } | { ok: false; error: NextResponse }> {
  if (typeof password !== "string" || password.length === 0) {
    return {
      ok: false,
      error: NextResponse.json({ message: "Your password is required to confirm this action" }, { status: 400 }),
    };
  }

  await dbConnect();
  const admin = await Customer.findById(userId).select("password failedLoginAttempts lockUntil").lean() as
    | { password?: string; failedLoginAttempts?: number; lockUntil?: Date }
    | null;

  if (!admin?.password) {
    return { ok: false, error: NextResponse.json({ message: "Password confirmation unavailable for this account" }, { status: 400 }) };
  }

  if (admin.lockUntil && admin.lockUntil > new Date()) {
    const minutes = Math.ceil((admin.lockUntil.getTime() - Date.now()) / 60000);
    return {
      ok: false,
      error: NextResponse.json(
        { message: `Too many failed attempts. Try again in ${minutes} minute(s).` },
        { status: 423 }
      ),
    };
  }

  const matches = await bcrypt.compare(password, admin.password);
  if (!matches) {
    // Same lockout ladder as the login route, on the same fields, so an attacker gains
    // nothing by attacking this surface instead of the front door.
    const attempts = (admin.failedLoginAttempts || 0) + 1;
    const updates: Record<string, unknown> =
      attempts >= 10
        ? { failedLoginAttempts: 0, lockUntil: new Date(Date.now() + 15 * 60 * 1000) }
        : { failedLoginAttempts: attempts };
    await Customer.updateOne({ _id: userId }, { $set: updates });

    return { ok: false, error: NextResponse.json({ message: "Incorrect password" }, { status: 401 }) };
  }

  if (admin.failedLoginAttempts || admin.lockUntil) {
    await Customer.updateOne({ _id: userId }, { $set: { failedLoginAttempts: 0, lockUntil: null } });
  }

  return { ok: true };
}

/**
 * Authorises a *read* of someone's wallet: the owner, or any staff member.
 *
 * Staff reads are intentionally broader than staff writes — a manager who can see a
 * customer at all can see that customer's ledger, which is what makes the attribution in
 * §4.4 reviewable by the people who need to review it.
 */
export async function requireWalletRead(
  targetUserId?: string | null
): Promise<GuardResult> {
  try {
    const payload = await readSession();
    if (!payload) return unauthorised("Not authenticated", 401);

    const isStaff = payload.role === "admin" || payload.role === "manager";

    /**
     * No target means "my own wallet".
     *
     * A customer reading their own wallet sends no `userId` — there is nothing for the
     * browser to name, and letting it name itself would be a value the server then has to
     * distrust anyway. An earlier version compared `payload.userId` against the empty
     * string, which is never equal, so every customer got a 403 on their own wallet.
     */
    const requestedSomeoneElse = Boolean(targetUserId);

    if (!requestedSomeoneElse) {
      // Staff have no wallet of their own, so an unqualified read from staff is a mistake
      // rather than a request to see something.
      if (isStaff) {
        return unauthorised("Specify which customer's wallet to view", 400);
      }
      return { payload, actor: resolveActor(payload) as WalletActor };
    }

    const isOwner = payload.userId === targetUserId;
    if (!isOwner && !isStaff) {
      return unauthorised("Forbidden", 403);
    }

    return { payload, actor: resolveActor(payload) as WalletActor };
  } catch {
    return unauthorised("Auth validation error", 401);
  }
}
