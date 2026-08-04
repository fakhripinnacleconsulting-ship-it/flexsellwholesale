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

/**
 * Constant-time string comparison for secrets (CSRF tokens, webhook tokens).
 *
 * A plain `===` short-circuits on the first differing character, which leaks how much of a
 * guessed token was correct. Implemented in pure JS rather than `crypto.timingSafeEqual` so
 * it is usable from the Edge runtime (`proxy.ts`) as well as Node route handlers.
 */
export function timingSafeCompare(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  // Length is not secret — but still fold it into the result rather than returning early
  // on a mismatch, so the loop below always runs over a fixed span.
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) {
    diff |= a.charCodeAt(i % (a.length || 1)) ^ b.charCodeAt(i % (b.length || 1));
  }
  return diff === 0;
}

/**
 * Escapes a user-supplied string for safe use inside `new RegExp()`.
 *
 * Without this, a search box feeds arbitrary regex to Mongo — at best a crash on an
 * unbalanced bracket, at worst a catastrophically backtracking pattern that pins the CPU.
 */
export function escapeRegex(input: string): string {
  return String(input).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

  // Unwrap nested Next.js _next/image proxy URLs stored in DB
  if (trimmed.includes("_next/image") && trimmed.includes("url=")) {
    try {
      const parsed = new URL(trimmed.startsWith("http") ? trimmed : `https://dummy.com${trimmed.startsWith("/") ? "" : "/"}${trimmed}`);
      const target = parsed.searchParams.get("url");
      if (target) {
        return sanitizeImgUrl(decodeURIComponent(target), fallback);
      }
    } catch {
      // ignore parse error, continue
    }
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
