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
  fallback: string = ""
): string {
  if (!url) return fallback;
  const trimmed = String(url).trim().replace(/^['"]|['"]$/g, "");
  if (
    !trimmed ||
    trimmed === "null" ||
    trimmed === "undefined" ||
    trimmed.includes("[link removed]") ||
    trimmed.includes("[link]") ||
    trimmed.includes("<") ||
    trimmed.includes(">")
  ) {
    return fallback;
  }

  if (trimmed.startsWith("data:") || trimmed.startsWith("blob:")) {
    return trimmed;
  }

  let formatted = trimmed;
  if (formatted.startsWith("//")) {
    formatted = `https:${formatted}`;
  } else if (!formatted.startsWith("http://") && !formatted.startsWith("https://") && !formatted.startsWith("/")) {
    if (formatted.match(/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(\/|$)/)) {
      formatted = `https://${formatted}`;
    } else {
      formatted = `/${formatted}`;
    }
  }

  if (formatted.startsWith("http://") || formatted.startsWith("https://")) {
    try {
      new URL(formatted);
      return formatted;
    } catch {
      return fallback;
    }
  }

  return formatted;
}
