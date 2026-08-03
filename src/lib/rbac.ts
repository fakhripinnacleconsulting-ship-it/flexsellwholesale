import { getActiveCustomerServer, getActiveManagerServer } from "./auth";

/**
 * Checks if the user is an admin or a manager with the required permission.
 * Returns the user object if authorized, otherwise returns null.
 * 
 * @param requiredPermission The specific permission required (e.g. "orders_b2b").
 * If requiredPermission is null/undefined, it only checks if the user is an admin or ANY manager.
 */
export async function verifyAdminOrManagerAccess(requiredPermission?: string) {
  // First, check if it's a master admin
  const admin = await getActiveCustomerServer();
  if (admin && admin.role === "admin") {
    return { user: admin, type: "admin" };
  }

  // Next, check if it's a manager
  const manager = await getActiveManagerServer();
  if (manager && manager.status === "active") {
    if (!requiredPermission) {
      return { user: manager, type: "manager" };
    }

    if (manager.permissions) {
      const rootPermission = requiredPermission.split(":")[0];
      if (manager.permissions.includes(requiredPermission) || manager.permissions.includes(rootPermission)) {
        return { user: manager, type: "manager" };
      }
    }
  }

  return null;
}

/**
 * Helper to check multiple permissions (OR condition - if user has ANY of them, access is granted)
 */
export async function verifyAnyPermission(requiredPermissions: string[]) {
  const admin = await getActiveCustomerServer();
  if (admin && admin.role === "admin") {
    return { user: admin, type: "admin" };
  }

  const manager = await getActiveManagerServer();
  if (manager && manager.status === "active") {
    if (manager.permissions) {
      const hasPermission = requiredPermissions.some(reqPerm => {
        const rootPermission = reqPerm.split(":")[0];
        return manager.permissions.includes(reqPerm) || manager.permissions.includes(rootPermission);
      });
      if (hasPermission) {
        return { user: manager, type: "manager" };
      }
    }
  }

  return null;
}
