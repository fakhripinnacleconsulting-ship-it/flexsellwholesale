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
  fallback: string = "https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=600&q=80"
): string {
  if (!url) return fallback;
  const trimmed = url.trim();

  // Redirect known 404/dead unsplash image IDs to working product photo
  if (
    trimmed.includes("photo-1537655780520-1e392edd816a") ||
    trimmed.includes("photo-1610970881699-44a5587caa9a") ||
    trimmed.includes("photo-1590794056226-79ef3a8147e1")
  ) {
    return "https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=600&q=80";
  }

  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("/") ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("blob:")
  ) {
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
