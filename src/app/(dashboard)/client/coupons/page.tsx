"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToastStore } from "@/stores/toastStore";
import { Ticket, Copy, Check, Calendar, AlertCircle } from "lucide-react";
import { Coupon } from "@/types";
import { couponService } from "@/services/couponService";

export default function ClientCouponsPage() {
  const { addToast } = useToastStore();
  const [coupons, setCoupons] = React.useState<Coupon[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [copiedCode, setCopiedCode] = React.useState<string | null>(null);

  const fetchCoupons = async () => {
    try {
      setIsLoading(true);
      const data = await couponService.getCoupons();
      setCoupons(data);
    } catch (err: unknown) {
      console.error(err);
      addToast((err as any).message || "Failed to load coupons", "error");
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    fetchCoupons();
  }, []);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    addToast(`Coupon code "${code}" copied!`, "success");
    setTimeout(() => {
      setCopiedCode(null);
    }, 2000);
  };

  return (
    <div className="space-y-6 container mx-auto px-4 py-8 text-foreground max-w-5xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Active Available Coupons</h1>
        <p className="text-muted-foreground mt-1">Claim discount voucher codes to apply during bulk checkout.</p>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading coupons...</div>
      ) : coupons.length === 0 ? (
        <Card className="border border-border">
          <CardContent className="pt-10 pb-10 text-center">
            <Ticket className="mx-auto h-12 w-12 text-muted-foreground/50 mb-3" />
            <h3 className="text-lg font-bold">No active coupons</h3>
            <p className="text-muted-foreground text-sm max-w-sm mx-auto mt-1 mb-6">
              There are no wholesale coupon deals running at this time. Check back later!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {coupons.map((coupon) => (
            <Card key={coupon._id} className="border border-primary/20 shadow-sm relative overflow-hidden bg-gradient-to-br from-card to-secondary/5">
              {coupon.isPersonalized && (
                <div className="absolute top-0 right-0 bg-purple-600 text-white font-bold text-[8px] px-2 py-0.5 rounded-bl uppercase tracking-wider z-10 shadow-xs">
                  Exclusive Offer
                </div>
              )}
              {/* Scissors design line */}
              <div className="absolute top-0 bottom-0 left-[35%] border-l-2 border-dashed border-border pointer-events-none" />
              
              <div className="grid grid-cols-3 min-h-[140px] items-stretch">
                {/* Left Section: Discount */}
                <div className="col-span-1 bg-primary/5 flex flex-col items-center justify-center p-3 text-center border-r border-border/50">
                  <span className="text-2xl font-black text-primary">
                    {coupon.discountType === "flat" ? `₹${coupon.discountValue}` : `${coupon.discountValue}%`}
                  </span>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mt-0.5">
                    {coupon.discountType === "flat" ? "Flat Off" : "Discount"}
                  </span>
                </div>

                {/* Right Section: Details */}
                <div className="col-span-2 p-4 flex flex-col justify-between space-y-3">
                  <div>
                    <h3 className="font-mono font-black text-foreground tracking-wider text-base">{coupon.code}</h3>
                    <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> Min Order: ₹{coupon.minOrderValue}
                    </p>
                    {coupon.maxDiscount && (
                      <p className="text-[10px] text-primary/80 font-semibold">Max discount cap: ₹{coupon.maxDiscount}</p>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 border-t pt-2 mt-2">
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" /> Exp: {new Date(coupon.expiryDate).toLocaleDateString()}
                    </span>
                    <Button 
                      size="sm" 
                      variant={copiedCode === coupon.code ? "outline" : "default"} 
                      className="h-7 px-3 text-[10px] font-bold flex items-center gap-1.5"
                      onClick={() => handleCopyCode(coupon.code)}
                    >
                      {copiedCode === coupon.code ? (
                        <>
                          <Check className="h-3 w-3" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" /> Copy Code
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
