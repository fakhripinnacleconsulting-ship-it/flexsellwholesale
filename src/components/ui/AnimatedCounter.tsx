"use client";

import * as React from "react";

export interface AnimatedCounterProps {
  value: string | number;
  duration?: number; // duration in ms
  className?: string;
}

function parseCountString(raw: string) {
  const match = raw.match(/^([^\d]*)([\d,.]+)(.*)$/);
  if (!match) return { prefix: "", target: 0, suffix: raw, hasCommas: false, decimals: 0 };

  const prefix = match[1] || "";
  const numStr = match[2];
  const suffix = match[3] || "";
  const hasCommas = numStr.includes(",");

  const cleanNumStr = numStr.replace(/,/g, "");
  const target = parseFloat(cleanNumStr) || 0;

  const dotIndex = cleanNumStr.indexOf(".");
  const decimals = dotIndex >= 0 ? cleanNumStr.length - dotIndex - 1 : 0;

  return { prefix, target, suffix, hasCommas, decimals };
}

function formatNumber(num: number, hasCommas: boolean, decimals: number): string {
  let formatted = num.toFixed(decimals);
  if (hasCommas) {
    const parts = formatted.split(".");
    parts[0] = parseInt(parts[0], 10).toLocaleString("en-US");
    formatted = parts.join(".");
  }
  return formatted;
}

export function AnimatedCounter({ value, duration = 1800, className }: AnimatedCounterProps) {
  const containerRef = React.useRef<HTMLSpanElement>(null);
  const [displayValue, setDisplayValue] = React.useState<string>(() => {
    const str = String(value);
    const parsed = parseCountString(str);
    if (parsed.target === 0) return str;
    return parsed.prefix + formatNumber(0, parsed.hasCommas, parsed.decimals) + parsed.suffix;
  });

  const hasAnimatedRef = React.useRef(false);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const strValue = String(value);
    const parsed = parseCountString(strValue);

    if (parsed.target === 0) {
      setDisplayValue(strValue);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && !hasAnimatedRef.current) {
          hasAnimatedRef.current = true;
          let startTime: number | null = null;

          const step = (timestamp: number) => {
            if (!startTime) startTime = timestamp;
            const elapsed = timestamp - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Cubic Ease-Out curve for ultra smooth deceleration
            const easeOutProgress = 1 - Math.pow(1 - progress, 3);
            const currentNum = easeOutProgress * parsed.target;

            if (progress < 1) {
              setDisplayValue(parsed.prefix + formatNumber(currentNum, parsed.hasCommas, parsed.decimals) + parsed.suffix);
              requestAnimationFrame(step);
            } else {
              setDisplayValue(parsed.prefix + formatNumber(parsed.target, parsed.hasCommas, parsed.decimals) + parsed.suffix);
            }
          };

          requestAnimationFrame(step);
        }
      },
      { threshold: 0.15 }
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
    };
  }, [value, duration]);

  return (
    <span ref={containerRef} className={className}>
      {displayValue}
    </span>
  );
}
