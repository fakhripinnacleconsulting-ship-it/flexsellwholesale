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
