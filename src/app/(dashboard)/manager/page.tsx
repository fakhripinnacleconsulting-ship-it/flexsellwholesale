"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { useAuthStore } from "@/stores/authStore";
import { Shield, Clock, ShieldCheck } from "lucide-react";

export default function ManagerDashboardOverview() {
  const { manager } = useAuthStore();

  if (!manager) return null;

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Manager Portal</h1>
        <p className="text-muted-foreground text-sm">Welcome back, {manager.name}. Access your assigned operational modules using the sidebar.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="border border-border shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-green-500" /> Account Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-1 mt-2">
              <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Status</p>
              <p className="text-xl font-black text-foreground uppercase">{manager.status}</p>
            </div>
            <div className="flex flex-col gap-1 mt-4">
              <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Assigned Role</p>
              <p className="font-semibold text-primary">{(manager as any).assignedRole || "Staff Manager"}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-500" /> Access Privileges
            </CardTitle>
          </CardHeader>
          <CardContent>
             <div className="mt-2">
              <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Granted Permissions</p>
              <p className="text-3xl font-black text-foreground my-1">{manager.permissions?.length || 0}</p>
              <p className="text-xs text-muted-foreground">Modules available in your workspace</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Clock className="h-5 w-5 text-purple-500" /> Activity Log
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-1 mt-2">
              <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Last Login</p>
              <p className="text-sm font-semibold text-foreground">{manager.lastLogin ? new Date(manager.lastLogin).toLocaleString() : "First Login"}</p>
            </div>
            <div className="flex flex-col gap-1 mt-4">
              <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Account Created</p>
              <p className="text-sm font-semibold text-foreground">{new Date(manager.createdAt).toLocaleDateString()}</p>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {manager.permissions?.length === 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
               <Shield className="h-8 w-8 text-amber-500 shrink-0" />
               <div>
                 <h3 className="text-lg font-bold text-amber-700 dark:text-amber-400">No Permissions Assigned</h3>
                 <p className="text-sm text-amber-600 dark:text-amber-500 mt-1">Your account currently has no module access. Please contact the Master Admin to assign permissions to your profile.</p>
               </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
