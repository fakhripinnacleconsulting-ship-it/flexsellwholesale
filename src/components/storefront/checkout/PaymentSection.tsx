import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { formatPrice } from "@/lib/utils";
import { Wallet, CreditCard, Banknote, CheckCircle2, AlertCircle } from "lucide-react";

export type CheckoutPaymentMethod = "Razorpay" | "COD" | "Wallet";

interface PaymentSectionProps {
  paymentMethod: CheckoutPaymentMethod;
  setPaymentMethod: (val: CheckoutPaymentMethod) => void;
  enableCod?: boolean;
  enableOnlinePayment?: boolean;
  /** Store Wallet balance in rupees, or null when the customer has no usable wallet. */
  walletBalance?: number | null;
  /** Order total, so a short balance can name the shortfall instead of just refusing. */
  orderTotal?: number;
}

export function PaymentSection({
  paymentMethod,
  setPaymentMethod,
  enableCod = true,
  enableOnlinePayment = true,
  walletBalance = null,
  orderTotal = 0,
}: PaymentSectionProps) {
  const hasWallet = walletBalance !== null && walletBalance > 0;
  const walletCovers = hasWallet && walletBalance >= orderTotal;
  const shortfall = hasWallet && !walletCovers ? orderTotal - walletBalance : 0;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Payment Method</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!enableCod && !enableOnlinePayment && !hasWallet && (
            <p className="text-sm text-destructive">No payment methods are currently available. Please contact support.</p>
          )}

          {hasWallet && (
            <div
              className={`relative overflow-hidden rounded-xl border p-5 transition-all duration-300 ease-out group ${
                !walletCovers
                  ? "bg-secondary/20 border-border opacity-70"
                  : paymentMethod === "Wallet"
                    ? "bg-primary/5 border-primary shadow-[0_0_15px_rgba(var(--primary),0.15)] -translate-y-0.5"
                    : "bg-white/40 dark:bg-white/5 border-border hover:bg-secondary/30 hover:border-primary/40 cursor-pointer hover:-translate-y-0.5"
              }`}
              onClick={() => walletCovers && setPaymentMethod("Wallet")}
            >
              {paymentMethod === "Wallet" && walletCovers && (
                <div className="absolute top-4 right-4 text-primary animate-in zoom-in duration-200">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              )}
              <div className="flex items-start gap-4">
                <div className={`p-2 rounded-lg ${paymentMethod === 'Wallet' ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground'}`}>
                  <Wallet className="w-6 h-6" />
                </div>
                <div className="flex-1 pr-6">
                  <div className="font-semibold text-foreground text-base cursor-pointer block flex items-center gap-2">
                    Store Wallet 
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                      {formatPrice(walletBalance)} available
                    </span>
                  </div>
                  {walletCovers ? (
                    <p className="text-sm text-muted-foreground mt-1">
                      Pay instantly from your prepaid balance. No payment gateway needed.
                    </p>
                  ) : (
                    <div className="mt-2 space-y-2">
                      <div className="flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400 font-medium bg-amber-50 dark:bg-amber-950/30 p-2 rounded-md">
                        <AlertCircle className="w-4 h-4" />
                        <span>{formatPrice(shortfall)} short for this order.</span>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
                        <div 
                          className="bg-primary h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, (walletBalance / orderTotal) * 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        <a href="/client/wallet" className="font-semibold text-primary hover:underline">Add money</a>{" "}
                        to use your wallet, or choose another method below.
                      </p>
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
