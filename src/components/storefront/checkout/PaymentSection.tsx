import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { formatPrice } from "@/lib/utils";
import { Wallet as AdvanceBalanceIcon, CreditCard, Banknote, CheckCircle2, AlertCircle } from "lucide-react";

export type CheckoutPaymentMethod = "Razorpay" | "COD" | "Wallet" | "BusinessAdvanceBalance";

interface PaymentSectionProps {
  paymentMethod: CheckoutPaymentMethod;
  setPaymentMethod: (val: CheckoutPaymentMethod) => void;
  enableCod?: boolean;
  enableOnlinePayment?: boolean;
  /** Store Advance Balance balance in rupees, or null when the customer has no usable wallet. */
  storeAdvanceBalance?: number | null;
  /** Business Advance Balance balance in rupees, or null when not eligible. */
  businessAdvanceBalance?: number | null;
  /** Whether the current user is an admin/manager checking out for a customer. */
  isAdmin?: boolean;
  /** Order total, so a short balance can name the shortfall instead of just refusing. */
  orderTotal?: number;
}

export function PaymentSection({
  paymentMethod,
  setPaymentMethod,
  enableCod = true,
  enableOnlinePayment = true,
  storeAdvanceBalance = null,
  businessAdvanceBalance = null,
  isAdmin = false,
  orderTotal = 0,
}: PaymentSectionProps) {
  const hasStoreWallet = storeAdvanceBalance !== null && storeAdvanceBalance > 0;
  const storeAdvanceBalanceCovers = hasStoreWallet && storeAdvanceBalance >= orderTotal;
  const storeShortfall = hasStoreWallet && !storeAdvanceBalanceCovers ? orderTotal - storeAdvanceBalance : 0;

  const hasBusinessWallet = isAdmin && businessAdvanceBalance !== null && businessAdvanceBalance > 0;
  const businessAdvanceBalanceCovers = hasBusinessWallet && businessAdvanceBalance >= orderTotal;
  const businessShortfall = hasBusinessWallet && !businessAdvanceBalanceCovers ? orderTotal - businessAdvanceBalance : 0;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Payment Method</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!enableCod && !enableOnlinePayment && !hasStoreWallet && !hasBusinessWallet && (
            <p className="text-sm text-destructive">No payment methods are currently available. Please contact support.</p>
          )}

          {hasStoreWallet && (
            <div
              className={`relative overflow-hidden rounded-xl border p-5 transition-all duration-300 ease-out group ${
                !storeAdvanceBalanceCovers
                  ? "bg-secondary/20 border-border opacity-70"
                  : paymentMethod === "Wallet"
                    ? "bg-primary/5 border-primary shadow-[0_0_15px_rgba(var(--primary),0.15)] -translate-y-0.5"
                    : "bg-white/40 dark:bg-white/5 border-border hover:bg-secondary/30 hover:border-primary/40 cursor-pointer hover:-translate-y-0.5"
              }`}
              onClick={() => storeAdvanceBalanceCovers && setPaymentMethod("Wallet")}
            >
              {paymentMethod === "Wallet" && storeAdvanceBalanceCovers && (
                <div className="absolute top-4 right-4 text-primary animate-in zoom-in duration-200">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              )}
              <div className="flex items-start gap-4">
                <div className={`p-2 rounded-lg ${paymentMethod === 'Wallet' ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground'}`}>
                  <AdvanceBalanceIcon className="w-6 h-6" />
                </div>
                <div className="flex-1 pr-6">
                  <div className="font-semibold text-foreground text-base cursor-pointer block flex items-center gap-2">
                    Store Advance Balance 
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                      {formatPrice(storeAdvanceBalance)} available
                    </span>
                  </div>
                  {storeAdvanceBalanceCovers ? (
                    <p className="text-sm text-muted-foreground mt-1">
                      Pay instantly from {isAdmin ? "the customer's" : "your"} prepaid store balance. No payment gateway needed.
                    </p>
                  ) : (
                    <div className="mt-2 space-y-2">
                      <div className="flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400 font-medium bg-amber-50 dark:bg-amber-950/30 p-2 rounded-md">
                        <AlertCircle className="w-4 h-4" />
                        <span>{formatPrice(storeShortfall)} short for this order.</span>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
                        <div 
                          className="bg-primary h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, (storeAdvanceBalance / orderTotal) * 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        <a href="/client/advance-balance" className="font-semibold text-primary hover:underline">Add money</a>{" "}
                        to use {isAdmin ? "this" : "your"} Advance Balance, or choose another method below.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {hasBusinessWallet && (
            <div
              className={`relative overflow-hidden rounded-xl border p-5 transition-all duration-300 ease-out group ${
                !businessAdvanceBalanceCovers
                  ? "bg-secondary/20 border-border opacity-70"
                  : paymentMethod === "BusinessAdvanceBalance"
                    ? "bg-primary/5 border-primary shadow-[0_0_15px_rgba(var(--primary),0.15)] -translate-y-0.5"
                    : "bg-white/40 dark:bg-white/5 border-border hover:bg-secondary/30 hover:border-primary/40 cursor-pointer hover:-translate-y-0.5"
              }`}
              onClick={() => businessAdvanceBalanceCovers && setPaymentMethod("BusinessAdvanceBalance")}
            >
              {paymentMethod === "BusinessAdvanceBalance" && businessAdvanceBalanceCovers && (
                <div className="absolute top-4 right-4 text-primary animate-in zoom-in duration-200">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              )}
              <div className="flex items-start gap-4">
                <div className={`p-2 rounded-lg ${paymentMethod === 'BusinessAdvanceBalance' ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground'}`}>
                  <AdvanceBalanceIcon className="w-6 h-6" />
                </div>
                <div className="flex-1 pr-6">
                  <div className="font-semibold text-foreground text-base cursor-pointer block flex items-center gap-2">
                    Business Advance Balance (Admin Only)
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                      {formatPrice(businessAdvanceBalance)} available
                    </span>
                  </div>
                  {businessAdvanceBalanceCovers ? (
                    <p className="text-sm text-muted-foreground mt-1">
                      Pay instantly from the customer's B2B credit line or business balance.
                    </p>
                  ) : (
                    <div className="mt-2 space-y-2">
                      <div className="flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400 font-medium bg-amber-50 dark:bg-amber-950/30 p-2 rounded-md">
                        <AlertCircle className="w-4 h-4" />
                        <span>{formatPrice(businessShortfall)} short for this order.</span>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
                        <div 
                          className="bg-primary h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, (businessAdvanceBalance / orderTotal) * 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {enableOnlinePayment && (
            <div 
              className={`relative overflow-hidden rounded-xl border p-5 transition-all duration-300 ease-out cursor-pointer group ${
                paymentMethod === "Razorpay" 
                  ? "bg-primary/5 border-primary shadow-[0_0_15px_rgba(var(--primary),0.15)] -translate-y-0.5" 
                  : "bg-white/40 dark:bg-white/5 border-border hover:bg-secondary/30 hover:border-primary/40 hover:-translate-y-0.5"
              }`}
              onClick={() => setPaymentMethod("Razorpay")}
            >
              {paymentMethod === "Razorpay" && (
                <div className="absolute top-4 right-4 text-primary animate-in zoom-in duration-200">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              )}
              <div className="flex items-start gap-4">
                <div className={`p-2 rounded-lg ${paymentMethod === 'Razorpay' ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground'}`}>
                  <CreditCard className="w-6 h-6" />
                </div>
                <div className="flex-1 pr-6">
                  <div className="font-semibold text-foreground text-base cursor-pointer block">
                    Online Payment
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Corporate credit cards, net banking, UPI, or corporate wallets.
                  </p>
                </div>
              </div>
            </div>
          )}

          {enableCod && (
            <div 
              className={`relative overflow-hidden rounded-xl border p-5 transition-all duration-300 ease-out cursor-pointer group ${
                paymentMethod === "COD" 
                  ? "bg-primary/5 border-primary shadow-[0_0_15px_rgba(var(--primary),0.15)] -translate-y-0.5" 
                  : "bg-white/40 dark:bg-white/5 border-border hover:bg-secondary/30 hover:border-primary/40 hover:-translate-y-0.5"
              }`}
              onClick={() => setPaymentMethod("COD")}
            >
              {paymentMethod === "COD" && (
                <div className="absolute top-4 right-4 text-primary animate-in zoom-in duration-200">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              )}
              <div className="flex items-start gap-4">
                <div className={`p-2 rounded-lg ${paymentMethod === 'COD' ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground'}`}>
                  <Banknote className="w-6 h-6" />
                </div>
                <div className="flex-1 pr-6">
                  <div className="font-semibold text-foreground text-base cursor-pointer block">
                    Cash on Delivery (COD)
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Pay via cash or UPI directly to our delivery executive.
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

    </>
  );
}
