"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Mail, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";

interface OtpVerificationModalProps {
  isOpen: boolean;
  email: string;
  onSuccess: (data: any) => void;
  onCancel: () => void;
  onResendOtp: () => Promise<boolean>;
}

export function OtpVerificationModal({
  isOpen,
  email,
  onSuccess,
  onCancel,
  onResendOtp,
}: OtpVerificationModalProps) {
  const [digits, setDigits] = React.useState<string[]>(["", "", "", "", "", ""]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isResending, setIsResending] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState("");
  const [cooldown, setCooldown] = React.useState(60);

  const inputRefs = React.useRef<(HTMLInputElement | null)[]>([]);

  React.useEffect(() => {
    let timer: any;
    if (isOpen && cooldown > 0) {
      timer = setInterval(() => {
        setCooldown((prev) => Math.max(0, prev - 1));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isOpen, cooldown]);

  React.useEffect(() => {
    if (isOpen) {
      setDigits(["", "", "", "", "", ""]);
      setErrorMsg("");
      setCooldown(60);
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDigitChange = (index: number, val: string) => {
    const cleanVal = val.replace(/[^0-9]/g, "");
    if (!cleanVal && val) return;

    const newDigits = [...digits];
    newDigits[index] = cleanVal.slice(-1);
    setDigits(newDigits);
    setErrorMsg("");

    if (cleanVal && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/[^0-9]/g, "").slice(0, 6);
    if (pasted) {
      const newDigits = pasted.split("");
      while (newDigits.length < 6) newDigits.push("");
      setDigits(newDigits);
      inputRefs.current[Math.min(pasted.length, 5)]?.focus();
    }
  };

  const otpCode = digits.join("");

  const handleVerify = async () => {
    if (otpCode.length < 6) {
      setErrorMsg("Please enter all 6 digits of the verification code.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp: otpCode }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Invalid verification code.");
      }

      onSuccess(data);
    } catch (err: any) {
      setErrorMsg(err.message || "Verification failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || isResending) return;
    setIsResending(true);
    setErrorMsg("");
    try {
      const success = await onResendOtp();
      if (success) {
        setCooldown(60);
        setDigits(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
      }
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-card border border-border rounded-xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-200">
        <div className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <Mail className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-bold tracking-tight">Verify Your Email Address</h2>
          <p className="text-xs text-muted-foreground">
            We have sent a 6-digit verification code to <strong className="text-foreground">{email}</strong>.
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg flex items-center gap-2 text-xs text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* 6 Digit Inputs */}
        <div className="flex justify-center gap-2 py-2">
          {digits.map((digit, idx) => (
            <Input
              key={idx}
              ref={(el) => {
                inputRefs.current[idx] = el;
              }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleDigitChange(idx, e.target.value)}
              onKeyDown={(e) => handleKeyDown(idx, e)}
              onPaste={handlePaste}
              className="w-11 h-12 text-center text-lg font-bold font-mono bg-background border-border focus:ring-2 focus:ring-primary rounded-lg"
            />
          ))}
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
          <span>Didn't receive code?</span>
          <button
            onClick={handleResend}
            disabled={cooldown > 0 || isResending}
            className={`font-semibold cursor-pointer flex items-center gap-1 ${
              cooldown > 0 ? "text-muted-foreground cursor-not-allowed" : "text-primary hover:underline"
            }`}
          >
            <RefreshCw className={`h-3 w-3 ${isResending ? "animate-spin" : ""}`} />
            {cooldown > 0 ? `Resend Code (${cooldown}s)` : "Resend Code"}
          </button>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
          <Button variant="outline" size="sm" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleVerify} disabled={isSubmitting || otpCode.length < 6} className="font-bold cursor-pointer">
            {isSubmitting ? "Verifying..." : "Verify & Complete Registration"}
          </Button>
        </div>
      </div>
    </div>
  );
}
