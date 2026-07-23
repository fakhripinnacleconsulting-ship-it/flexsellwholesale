import * as React from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface RatingProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
  readonly?: boolean;
}

export function Rating({ 
  value, 
  max = 5, 
  readonly: _readonly = true, 
  className, 
  ...props 
}: RatingProps) {
  return (
    <div className={cn("flex items-center gap-1", className)} {...props}>
      {Array.from({ length: max }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            "h-4 w-4",
            i < Math.round(value) 
              ? "fill-yellow-400 text-yellow-400" 
              : "fill-muted text-muted"
          )}
        />
      ))}
    </div>
  );
}
