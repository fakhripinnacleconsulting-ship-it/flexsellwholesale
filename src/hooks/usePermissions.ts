import { useAuthStore } from "@/stores/authStore";
import { usePathname } from "next/navigation";

export function usePermissions() {
  const { manager } = useAuthStore();
  const pathname = usePathname();

  // Determine if we are in a manager route
  const isManagerRoute = pathname?.startsWith("/manager") || false;

  const hasPermission = (module: string, action?: "create" | "read" | "update" | "delete"): boolean => {
    // If not a manager route, assume admin with full access (since this hook is used in shared components)
    if (!isManagerRoute) return true;

    // If manager isn't loaded yet or lacks permissions array
    if (!manager || !manager.permissions) return false;

    const perms = manager.permissions;

    // Legacy/Root permission check: gives full CRUD
    if (perms.includes(module)) return true;

    // If specific action is provided, check for module:action
    if (action) {
      return perms.includes(`${module}:${action}`);
    }

    // If no specific action is provided, just having the root or ANY action counts as having *some* permission
    return perms.some((p: string) => p.startsWith(`${module}:`));
  };

  return { hasPermission, manager, isManagerRoute };
}
