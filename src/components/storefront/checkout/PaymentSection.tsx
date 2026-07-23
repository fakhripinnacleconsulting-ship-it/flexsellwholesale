import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { formatPrice } from "@/lib/utils";

interface PaymentSectionProps {
  paymentMethod: "Razorpay" | "COD";
  setPaymentMethod: (val: "Razorpay" | "COD") => void;
  enableCod?: boolean;
  enableOnlinePayment?: boolean;
}

export function PaymentSection({
  paymentMethod,
  setPaymentMethod,
  enableCod = true,
  enableOnlinePayment = true
}: PaymentSectionProps) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Payment Method</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!enableCod && !enableOnlinePayment && (
            <p className="text-sm text-destructive">No payment methods are currently available. Please contact support.</p>
          )}
          
          {enableOnlinePayment && (
            <div 
              className={`border rounded-md p-4 cursor-pointer transition-colors ${
                paymentMethod === "Razorpay" 
                  ? "bg-primary/5 border-primary" 
                  : "bg-secondary/30 border-border hover:bg-secondary/50"
              }`}
              onClick={() => setPaymentMethod("Razorpay")}
            >
              <div className="flex items-start gap-3">
                <input 
                  type="radio" 
                  id="razorpay" 
                  name="payment" 
                  checked={paymentMethod === "Razorpay"}
                  onChange={() => setPaymentMethod("Razorpay")}
                  className="mt-1 text-primary focus:ring-primary bg-background border-border" 
                />
                <div className="flex-1">
                  <label htmlFor="razorpay" className="font-semibold text-foreground cursor-pointer block">
                    Online Payment (UPI/Cards/Netbanking)
                  </label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Pay instantly using corporate credit cards, net banking, UPI, or corporate wallets.
                  </p>
                </div>
              </div>
            </div>
          )}

          {enableCod && (
            <div 
              className={`border rounded-md p-4 cursor-pointer transition-colors ${
                paymentMethod === "COD" 
                  ? "bg-primary/5 border-primary" 
                  : "bg-secondary/30 border-border hover:bg-secondary/50"
              }`}
              onClick={() => setPaymentMethod("COD")}
            >
              <div className="flex items-start gap-3">
                <input 
                  type="radio" 
                  id="cod" 
                  name="payment" 
                  checked={paymentMethod === "COD"}
                  onChange={() => setPaymentMethod("COD")}
                  className="mt-1 text-primary focus:ring-primary bg-background border-border" 
                />
                <div className="flex-1">
                  <label htmlFor="cod" className="font-semibold text-foreground cursor-pointer block">
                    Cash on Delivery (COD)
                  </label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Pay via cash or UPI directly to our delivery executive upon receipt of goods.
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
