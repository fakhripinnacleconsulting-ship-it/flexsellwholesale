"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuthStore } from "@/stores/authStore";
import { useToastStore } from "@/stores/toastStore";
import { apiClient } from "@/lib/apiClient";
import { Shield, Lock, Mail, KeyRound, ArrowLeft, CheckCircle } from "lucide-react";

export default function ManagerLoginPage() {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [otp, setOtp] = React.useState("");
  const [step, setStep] = React.useState<"credentials" | "otp">("credentials");
  const [targetEmail, setTargetEmail] = React.useState("");
  const [devCode, setDevCode] = React.useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const router = useRouter();
  const { manager, checkSession } = useAuthStore();
  const { addToast } = useToastStore();

  const [checkedSession, setCheckedSession] = React.useState(false);

  React.useEffect(() => {
    checkSession().finally(() => {
      setCheckedSession(true);
    });
  }, [checkSession]);

  React.useEffect(() => {
    if (checkedSession && manager) {
      router.push("/manager");
    }
  }, [checkedSession, manager, router]);

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      addToast("Please enter both email and password.", "warning");
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await apiClient.post<any>("/auth/manager-login", {
        identifier: email.toLowerCase().trim(),
        password,
      });

      if (res.requiresOtp) {
        setTargetEmail(res.targetEmail || email);
        if (res.devOtp) setDevCode(res.devOtp);
        setStep("otp");
        addToast(res.message || "2FA Security Code sent to email.", "info");
      }
    } catch (err: any) {
      addToast(err.message || "Invalid credentials", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.length < 6) {
      addToast("Please enter the 6-digit OTP security code.", "warning");
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await apiClient.post<any>("/auth/manager-verify-otp", {
        email: email.toLowerCase().trim(),
        otp: otp.trim(),
      });

      if (res.manager) {
        useAuthStore.setState({ manager: res.manager });
        addToast("Manager authenticated successfully via 2FA.", "success");
        router.push("/manager");
      }
    } catch (err: any) {
      addToast(err.message || "OTP verification failed", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-secondary/20 p-4 text-foreground">
      <div className="w-full max-w-md">
        <div className="text-center mb-8 flex flex-col items-center">
          <Image src="/Flexsell%20Logo.png" alt="Flexsell Logo" width={200} height={60} className="h-12 w-auto object-contain mb-6" />
          <div className="inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary font-bold text-sm border border-primary/20 shadow-sm">
            <Shield className="h-4 w-4" /> Manager Portal 2FA Access
          </div>
        </div>

        <Card className="shadow-2xl border-border">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-2xl font-bold tracking-tight">
              {step === "credentials" ? "Staff Login" : "2FA Security Verification"}
            </CardTitle>
            <CardDescription className="text-xs">
              {step === "credentials"
                ? "Enter your manager credentials to request 2FA authentication."
                : `Enter the 6-digit security code sent to ${targetEmail}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {step === "credentials" ? (
              <form onSubmit={handleCredentialsSubmit} className="space-y-5">
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

                <Button type="submit" className="w-full h-11 font-bold text-[15px] shadow-md mt-2 cursor-pointer" disabled={isSubmitting}>
                  {isSubmitting ? "Validating & Sending OTP..." : "Continue to 2FA"}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleOtpSubmit} className="space-y-5">
                {devCode && (
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-lg text-xs font-mono text-center text-emerald-700 dark:text-emerald-300">
                    <span className="font-bold uppercase tracking-wider block text-[10px]">Development 2FA OTP Code</span>
                    <span className="text-2xl font-black tracking-widest">{devCode}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">6-Digit OTP Code</label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-muted-foreground" />
                    <Input 
                      type="text" 
                      placeholder="123456" 
                      maxLength={6}
                      className="pl-10 h-12 bg-background font-mono text-center text-lg tracking-[8px] font-bold" 
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full h-11 font-bold text-[15px] shadow-md cursor-pointer" disabled={isSubmitting}>
                  {isSubmitting ? "Verifying Code..." : "Verify OTP & Log In"}
                </Button>

                <button
                  type="button"
                  onClick={() => setStep("credentials")}
                  className="w-full text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-1.5 font-semibold pt-2 cursor-pointer"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Back to Credentials
                </button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
      <div className="mt-8 text-center text-xs text-muted-foreground font-medium">
        &copy; {new Date().getFullYear()} FlexSell Wholesale. 2FA Security Network.
      </div>
    </div>
  );
}
