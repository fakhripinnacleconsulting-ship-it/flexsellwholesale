"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Eye, EyeOff, ShieldCheck, Truck, Sparkles } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useToastStore } from "@/stores/toastStore";
import { motion } from "framer-motion";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl");

  const [identifier, setIdentifier] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const { login, loginWithGoogle, error, clearError } = useAuthStore();
  const { addToast } = useToastStore();

  React.useEffect(() => {
    clearError();

    const initGoogleGsi = () => {
      if (typeof window !== "undefined" && (window as any).google?.accounts?.id) {
        try {
          (window as any).google.accounts.id.initialize({
            client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "652908610181-88s80steoogb6d6lsg60eo5vsc7pn5ff.apps.googleusercontent.com",
            callback: handleGoogleResponse,
          });

          const container = document.getElementById("google-signin-btn");
          if (container) {
            container.innerHTML = "";
            (window as any).google.accounts.id.renderButton(container, {
              theme: "outline",
              size: "large",
              width: "100%",
              text: "signin_with",
              shape: "rectangular",
              logo_alignment: "left",
            });
          }
        } catch (err) {
          console.error("Failed to initialize Google Sign-In:", err);
        }
      }
    };

    if (typeof window !== "undefined" && (window as any).google?.accounts?.id) {
      initGoogleGsi();
    } else {
      const existingScript = document.getElementById("google-gsi-script");
      if (!existingScript) {
        const script = document.createElement("script");
        script.id = "google-gsi-script";
        script.src = "https://accounts.google.com/gsi/client";
        script.async = true;
        script.defer = true;
        script.onload = initGoogleGsi;
        document.body.appendChild(script);
      } else {
        existingScript.addEventListener("load", initGoogleGsi);
      }
    }
  }, []);

  const handleGoogleResponse = async (response: any) => {
    if (!response || !response.credential) {
      addToast("Google Sign-In credential missing", "error");
      return;
    }
    setIsSubmitting(true);
    try {
      const success = await loginWithGoogle(response.credential);
      if (success) {
        addToast("Logged in via Google successfully!", "success");
        const currentCustomer = useAuthStore.getState().customer;
        const redirectDest = currentCustomer?.role === "admin" ? "/admin" : (callbackUrl || "/client");
        router.push(redirectDest);
        router.refresh();
      } else {
        addToast("Google Sign-In failed", "error");
      }
    } catch (err: unknown) {
      addToast((err as any).message || "Google Sign-In failed", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier || !password) {
      addToast("Please fill in all fields", "warning");
      return;
    }

    setIsSubmitting(true);
    const success = await login(identifier, password);
    setIsSubmitting(false);

    if (success) {
      addToast("Signed in successfully!", "success");
      const currentCustomer = useAuthStore.getState().customer;
      const redirectDest = currentCustomer?.role === "admin" ? "/admin" : (callbackUrl || "/client");
      router.push(redirectDest);
      router.refresh();
    } else {
      addToast(useAuthStore.getState().error || "Invalid credentials", "error");
    }
  };

  return (
    <div className="container mx-auto px-4 py-12 flex justify-center items-center text-foreground min-h-[75vh]">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-12 rounded-2xl overflow-hidden border border-border shadow-xl bg-card"
      >
        {/* Left Branding Panel */}
        <div className="md:col-span-5 bg-gradient-to-br from-primary via-emerald-600 to-emerald-700 p-8 text-primary-foreground flex flex-col justify-between hidden md:flex">
          <div className="space-y-4">
            <span className="inline-block bg-white/20 backdrop-blur text-white text-xs font-extrabold px-3 py-1 rounded-full uppercase tracking-wider">
              FlexSell Direct
            </span>
            <h2 className="text-2xl font-black leading-tight">
              India's Premier Factory Sourcing Platform
            </h2>
            <p className="text-xs text-white/90 leading-relaxed">
              Access container-load pricing, verified quality checks, and nationwide cargo shipping directly from manufacturers.
            </p>
          </div>

          <div className="space-y-3 pt-6 border-t border-white/20 text-xs">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              <span>Verified Tax Invoices & Billing</span>
            </div>
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 shrink-0" />
              <span>Surat Cargo Logistics Dispatch</span>
            </div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 shrink-0" />
              <span>Dropshipper White-Label Shipping</span>
            </div>
          </div>
        </div>

        {/* Right Form Panel */}
        <div className="md:col-span-7 p-6 sm:p-8 space-y-6">
          <div className="text-center md:text-left space-y-1">
            <h1 className="text-2xl font-black tracking-tight">Welcome Back</h1>
            <p className="text-xs text-muted-foreground">
              Sign in with your Email or Account ID (e.g. FSW-0001)
            </p>
          </div>

          {error && (
            <div className="bg-destructive/10 text-destructive text-xs p-3 rounded-md border border-destructive/20 text-center font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold">Email or Account ID</label>
              <Input
                type="text"
                placeholder="Enter email or Account ID"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                disabled={isSubmitting}
                required
                className="text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold">Password</label>
                <Link
                  href="/forgot-password"
                  className="text-[11px] text-primary font-bold hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isSubmitting}
                  required
                  className="pr-10 text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full font-bold mt-2" disabled={isSubmitting}>
              {isSubmitting ? "Signing In..." : "Sign In"}
            </Button>
          </form>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-border"></div>
            <span className="flex-shrink mx-4 text-muted-foreground text-[10px] uppercase font-bold">Or continue with</span>
            <div className="flex-grow border-t border-border"></div>
          </div>

          <div id="google-signin-btn" className="w-full min-h-[40px] flex justify-center items-center"></div>

          <div className="text-center text-xs border-t pt-4">
            Don't have an account?{" "}
            <Link href="/register" className="text-primary font-bold hover:underline">
              Create an Account
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense fallback={
      <div className="container mx-auto px-4 py-16 flex justify-center text-foreground">
        <div className="text-center font-medium">Loading form...</div>
      </div>
    }>
      <LoginForm />
    </React.Suspense>
  );
}
