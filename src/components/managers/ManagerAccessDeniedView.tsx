"use client";

import React from "react";
import { ShieldAlert, ArrowLeft, Lock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import Link from "next/link";

interface ManagerAccessDeniedViewProps {
  requiredPermission?: string;
}

export function ManagerAccessDeniedView({ requiredPermission = "orders_dropshipping" }: ManagerAccessDeniedViewProps) {
  return (
    <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-6">
      <div className="relative inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-red-500/10 border border-red-500/20 text-red-500 shadow-xl">
        <ShieldAlert className="h-10 w-10 animate-pulse" />
        <div className="absolute -bottom-1 -right-1 bg-red-600 text-white rounded-full p-1 border-2 border-background">
          <Lock className="h-3.5 w-3.5" />
        </div>
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-black tracking-tight text-foreground">Access Restricted for Manager</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Your Manager account is logged in, but you do not have the required permission module to access the Dropshipping Order Creator.
        </p>
      </div>

      <div className="bg-secondary/20 p-4 rounded-xl border border-border text-left space-y-2 text-xs">
        <div className="flex justify-between items-center border-b pb-2">
          <span className="text-muted-foreground uppercase font-bold text-[10px]">Required Module</span>
          <span className="font-mono font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded">
            {requiredPermission}
          </span>
        </div>
        <div className="flex justify-between items-center pt-1">
          <span className="text-muted-foreground">Permission Category:</span>
          <span className="font-semibold text-foreground">Orders ➔ Dropshipping Orders</span>
        </div>
      </div>

      <div className="pt-2 flex justify-center gap-4">
        <Link href="/manager">
          <Button variant="default" className="font-bold text-xs gap-2 cursor-pointer shadow-md">
            <ArrowLeft className="h-4 w-4" /> Return to Manager Portal
          </Button>
        </Link>
      </div>
    </div>
  );
}
