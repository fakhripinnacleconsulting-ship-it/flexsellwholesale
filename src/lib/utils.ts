import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(
  price: number,
  options: {
    notation?: Intl.NumberFormatOptions["notation"];
  } = {}
) {
  const { notation = "standard" } = options;

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    notation,
    maximumFractionDigits: 2,
  }).format(price);
}

export function truncate(str: string, length: number) {
  if (!str) return "";
  return str.length > length ? `${str.substring(0, length)}...` : str;
}

export function sanitizeImgUrl(
  url: string,
  fallback: string = "https://placehold.co/400x400/10b981/ffffff?text=Product"
): string {
  if (!url) return fallback;
  const trimmed = url.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("/")) {
    return trimmed;
  }
  if (trimmed.startsWith("//")) {
    return `https:${trimmed}`;
  }
  if (trimmed.match(/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(\/|$)/)) {
    return `https://${trimmed}`;
  }
  return `/${trimmed}`;
}
