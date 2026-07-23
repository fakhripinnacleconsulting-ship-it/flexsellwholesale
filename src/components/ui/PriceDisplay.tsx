import * as React from "react";
import { cn, formatPrice } from "@/lib/utils";
import { Badge } from "./Badge";

interface PriceDisplayProps extends React.HTMLAttributes<HTMLDivElement> {
  price: number;
  mrp: number;
  discount?: number;
  size?: "sm" | "default" | "lg";
  showBadge?: boolean;
}

export function PriceDisplay({
  price,
  mrp,
  discount,
  size = "default",
  showBadge = true,
  className,
  ...props
}: PriceDisplayProps) {
  const isDiscounted = mrp > price;
  
  return (
    <div className={cn("flex items-center gap-2 flex-wrap", className)} {...props}>
      <span
        className={cn("font-bold text-foreground", {
          "text-lg": size === "sm",
          "text-xl": size === "default",
          "text-3xl": size === "lg",
        })}
      >
        {formatPrice(price)}
      </span>
      
      {isDiscounted && (
        <>
          <span
            className={cn("text-muted-foreground line-through", {
              "text-xs": size === "sm",
              "text-sm": size === "default",
              "text-base": size === "lg",
            })}
          >
            {formatPrice(mrp)}
          </span>
          
          {showBadge && discount && discount > 0 && (
            <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-[10px]">
              {discount}% OFF
            </Badge>
          )}
        </>
      )}
    </div>
  );
}
