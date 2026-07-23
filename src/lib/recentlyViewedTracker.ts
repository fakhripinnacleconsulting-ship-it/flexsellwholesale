"use client";

const RECENTLY_VIEWED_KEY = "flexsell-recently-viewed";
const MAX_ITEMS = 10;

export function addToRecentlyViewed(productId: string): void {
  if (typeof window === "undefined" || !productId) return;
  try {
    const stored = localStorage.getItem(RECENTLY_VIEWED_KEY);
    let ids: string[] = stored ? JSON.parse(stored) : [];
    
    // Remove if already exists to bring it to the front
    ids = ids.filter((id) => id !== productId);
    ids.unshift(productId);

    if (ids.length > MAX_ITEMS) {
      ids = ids.slice(0, MAX_ITEMS);
    }

    localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(ids));
  } catch {
    // Ignore storage errors
  }
}

export function getRecentlyViewed(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(RECENTLY_VIEWED_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function clearRecentlyViewed(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(RECENTLY_VIEWED_KEY);
  } catch {
    // Ignore storage errors
  }
}
