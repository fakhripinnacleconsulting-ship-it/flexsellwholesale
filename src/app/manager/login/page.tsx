"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuthStore } from "@/stores/authStore";
import { useToastStore } from "@/stores/toastStore";
import { Shield, Lock, Mail } from "lucide-react";

export default function ManagerLoginPage() {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const router = useRouter();
  const { managerLogin, isLoading, manager, checkSession } = useAuthStore();
  const { addToast } = useToastStore();

  React.useEffect(() => {
    checkSession();
  }, [checkSession]);

  React.useEffect(() => {
    if (manager) {
      router.push("/manager");
    }
  }, [manager, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      addToast("Please enter both email and password.", "warning");
      return;
    }

    const success = await managerLogin(email.toLowerCase().trim(), password);
    if (success) {
      addToast("Welcome to the Manager Portal.", "success");
      router.push("/manager");
    } else {
      addToast(useAuthStore.getState().error || "Login failed", "error");
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-secondary/20 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8 flex flex-col items-center">
          <Image src="/Flexsell%20Logo.png" alt="Flexsell Logo" width={200} height={60} className="h-12 w-auto object-contain mb-6" />
          <div className="inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary font-bold text-sm border border-primary/20 shadow-sm">
            <Shield className="h-4 w-4" /> Manager Portal Access
          </div>
        </div>

        <Card className="shadow-2xl border-border">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-2xl font-bold tracking-tight">Staff Login</CardTitle>
            <CardDescription className="text-sm">Enter your manager credentials to continue.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-muted-foreground" />
                  <Input 
                    type="email" 
                    placeholder="manager@flexsell.com" 
                    className="pl-10 h-11 bg-background" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-muted-foreground" />
                  <Input 
                    type="password" 
                    placeholder="••••••••" 
                    className="pl-10 h-11 bg-background" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <Button type="submit" className="w-full h-11 font-bold text-[15px] shadow-md mt-2" disabled={isLoading}>
                {isLoading ? "Authenticating..." : "Secure Login"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
      <div className="mt-8 text-center text-xs text-muted-foreground font-medium">
        &copy; {new Date().getFullYear()} FlexSell Wholesale. Secure Internal Network.
      </div>
    </div>
  );
}
