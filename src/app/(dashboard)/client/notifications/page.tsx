"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bell, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function ClientNotificationsPage() {
  const router = useRouter();

  React.useEffect(() => {
    // Auto redirect to customer dashboard
    const timer = setTimeout(() => {
      router.replace("/client");
    }, 2000);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="container mx-auto px-4 py-16 text-center max-w-md space-y-4">
      <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto">
        <Bell className="h-6 w-6" />
      </div>
      <h2 className="text-xl font-bold text-foreground">Notifications integrated into Header</h2>
      <p className="text-sm text-muted-foreground">
        All your live order updates and notifications are accessible anytime directly from the <strong>Bell Icon</strong> in the top navigation header.
      </p>
      <div className="pt-2">
        <Button onClick={() => router.push("/client")} size="sm" className="font-bold cursor-pointer">
          <ArrowLeft className="mr-2 h-4 w-4" /> Go to Dashboard
        </Button>
      </div>
    </div>
  );
}
