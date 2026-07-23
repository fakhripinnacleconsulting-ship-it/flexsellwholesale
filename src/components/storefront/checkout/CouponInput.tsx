import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { formatPrice } from "@/lib/utils";

interface CouponInputProps {
  appliedCoupon: any;
  couponDiscount: number;
  couponCode: string;
  setCouponCode: (val: string) => void;
  handleApplyCoupon: () => void;
  handleRemoveCoupon: () => void;
  isValidatingCoupon: boolean;
}

export function CouponInput({
  appliedCoupon,
  couponDiscount,
  couponCode,
  setCouponCode,
  handleApplyCoupon,
  handleRemoveCoupon,
  isValidatingCoupon
}: CouponInputProps) {
  return (
    <div className="space-y-2 border-b pb-4">
      <label className="text-xs font-bold uppercase text-muted-foreground block">Have a Coupon / Promo Code?</label>
      {appliedCoupon ? (
        <div className="flex items-center justify-between bg-primary/10 border border-primary/20 p-2.5 rounded-lg">
          <div>
            <span className="font-mono font-bold text-primary text-xs">{appliedCoupon.couponCode}</span>
            <span className="text-[10px] text-muted-foreground block">
              Saved {formatPrice(couponDiscount)}
            </span>
          </div>
          <Button type="button" variant="ghost" size="sm" className="h-7 text-xs text-destructive font-semibold" onClick={handleRemoveCoupon}>
            Remove
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Input
            placeholder="e.g. B2B15"
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value)}
            className="font-mono uppercase h-9 text-xs"
          />
          <Button type="button" size="sm" className="h-9 font-bold px-4" onClick={handleApplyCoupon} disabled={isValidatingCoupon}>
            {isValidatingCoupon ? "..." : "Apply"}
          </Button>
        </div>
      )}
    </div>
  );
}
