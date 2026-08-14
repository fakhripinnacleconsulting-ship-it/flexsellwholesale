import { verifyToken, getTokenFromCookie } from "@/lib/auth";
import { NextResponse } from "next/server";
import Manager from "@/models/Manager";
import dbConnect from "@/lib/dbConnect";
import { dispatchEventServer } from "@/lib/events/eventDispatcherServer";

export interface AuthenticatedRequestState {
  userId: string;
  email: string;
  role: string;
}

export async function requireAuth(requiredRole?: "admin" | "customer"): Promise<{
  payload?: AuthenticatedRequestState;
  error?: NextResponse;
}> {
  try {
    const token = await getTokenFromCookie();
    if (!token) {
      return { error: NextResponse.json({ message: "Not authenticated" }, { status: 401 }) };
    }

    const payload = verifyToken(token);
    if (!payload) {
      return { error: NextResponse.json({ message: "Invalid session" }, { status: 401 }) };
    }

    if (requiredRole && payload.role !== requiredRole) {
      return { error: NextResponse.json({ message: "Insufficient permissions" }, { status: 403 }) };
    }

    return { payload };
  } catch (_error) {
    return { error: NextResponse.json({ message: "Auth validation error" }, { status: 401 }) };
  }
}

export async function requireAdminOrManagerAuth(permission?: string): Promise<{
  payload?: AuthenticatedRequestState;
  error?: NextResponse;
}> {
  try {
    const token = await getTokenFromCookie();
    if (!token) {
      return { error: NextResponse.json({ message: "Not authenticated" }, { status: 401 }) };
    }

    const payload = verifyToken(token);
    if (!payload) {
      return { error: NextResponse.json({ message: "Invalid session" }, { status: 401 }) };
    }

    if (payload.role === "admin") {
      return { payload };
    }

    if (payload.role === "manager") {
      if (permission) {
        await dbConnect();
        const managerDoc = await Manager.findById(payload.userId).lean();
        if (!managerDoc || managerDoc.status !== "active") {
          return { error: NextResponse.json({ message: "Forbidden: Account inactive or not found" }, { status: 403 }) };
        }
        
        const perms = managerDoc.permissions || [];
        const rootPermission = permission.split(":")[0];
        
        // Allow access if they have the specific 'module:action' permission
        // OR if they have the legacy 'module' permission which implies full CRUD
        if (perms.includes(permission) || perms.includes(rootPermission)) {
          return { payload };
        }
      } else {
        return { payload };
      }
    }

    // Dispatch Security Alert for Unauthorized Access Attempt
    if (payload.role === "manager") {
      dispatchEventServer({
        eventType: "SECURITY_ALERT",
        category: "security",
        actor: { role: "manager", id: payload.userId, name: payload.email },
        recipient: { role: "admin" },
        entity: { type: "permission", id: permission || "unknown" },
        data: { attemptedPermission: permission }
      });
    }

    return { error: NextResponse.json({ message: "Forbidden: Insufficient permissions" }, { status: 403 }) };
  } catch (_error) {
    return { error: NextResponse.json({ message: "Auth validation error" }, { status: 401 }) };
  }
}

export async function verifyManagerOrderAccess(
  payload: AuthenticatedRequestState,
  order: { orderType?: string; [key: string]: unknown } | null | undefined
  // `manager` is returned so callers can attribute order-history entries to the person who
  // acted. The manager document is already loaded here for the permission check, so this
  // costs nothing and saves every caller a second lookup.
): Promise<{ allowed: boolean; error?: NextResponse; manager?: { id?: string; name?: string } }> {
  if (payload.role === "admin") {
    return { allowed: true };
  }

  if (payload.role === "manager") {
    await dbConnect();
    const managerDoc = await Manager.findById(payload.userId).lean();
    if (!managerDoc || managerDoc.status !== "active") {
      return {
        allowed: false,
        error: NextResponse.json(
          { message: "Forbidden: Manager account suspended or inactive" },
          { status: 403 }
        )
      };
    }

    const perms: string[] = managerDoc.permissions || [];
    const hasPerm = (p: string) =>
      perms.includes(p) ||
      perms.includes(`${p}:read`) ||
      perms.includes(`${p}:update`) ||
      perms.includes(`${p}:create`) ||
      perms.includes(`${p}:delete`) ||
      perms.includes("ops_shipping") ||
      perms.includes("orders");

    const orderType = order?.orderType;
    let allowed = false;
    if (orderType === "B2C" && hasPerm("orders_b2c")) allowed = true;
    if (orderType === "B2B" && hasPerm("orders_b2b")) allowed = true;
    if (!orderType && hasPerm("orders_b2b")) allowed = true; // Legacy B2B default
    if (orderType === "Dropshipping" && hasPerm("orders_dropshipping")) allowed = true;
    if (hasPerm("ops_shipping") || hasPerm("orders")) allowed = true;

    if (!allowed) {
      return {
        allowed: false,
        error: NextResponse.json(
          { message: "Forbidden: You don't have access to this order type." },
          { status: 403 }
        )
      };
    }

    return {
      allowed: true,
      manager: { id: String(managerDoc._id), name: (managerDoc as { name?: string }).name },
    };
  }

  return {
    allowed: false,
    error: NextResponse.json({ message: "Forbidden" }, { status: 403 })
  };
}

