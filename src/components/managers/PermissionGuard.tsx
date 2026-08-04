"use client";

import React from "react";
import { usePermissions } from "@/hooks/usePermissions";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { useAuthStore } from "@/stores/authStore";

interface PermissionGuardProps {
  children: React.ReactNode;
  requiredPermissions: string[];
}

export function PermissionGuard({ children, requiredPermissions }: PermissionGuardProps) {
  const { hasPermission, isManagerRoute } = usePermissions();
  const { manager, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // If not a manager route or not a manager, bypass the guard (admin or public access)
  if (!isManagerRoute || !manager) {
    return <>{children}</>;
  }

  // Check if manager has at least one of the required permissions
  const hasAccess = requiredPermissions.some((perm) => {
    if (perm.includes(":")) {
      const [module, action] = perm.split(":");
      return hasPermission(module, action as any);
    }
    return hasPermission(perm);
  });

  if (!hasAccess) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4 space-y-4">
        <ShieldAlert className="h-16 w-16 text-destructive/60" />
        <h1 className="text-3xl font-black text-foreground">Access Denied</h1>
        <p className="text-muted-foreground max-w-md">
          You do not have the required permissions to view this page. If you believe this is an error, please contact your administrator.
        </p>
        <Link href="/manager">
          <Button variant="outline" className="mt-4 font-bold">
            Return to Dashboard
          </Button>
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
