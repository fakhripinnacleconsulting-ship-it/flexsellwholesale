/**
 * Client-readable session *hint* cookie.
 *
 * The real session lives in the httpOnly `token` cookie, which JavaScript cannot read.
 * Without a hint, every page load has to ask the server "am I logged in?" — which cost
 * two uncacheable API calls per guest pageview (`/customers/active` then `/managers/active`).
 *
 * This cookie exists purely so the client can skip that call when there is obviously no
 * session. It is NEVER authorization: it carries no identity, no role, and no PII, and
 * every protected route still verifies the JWT server-side (see `proxy.ts`, `authGuard.ts`).
 * A user who forges it to "1" gains nothing but a wasted request that 401s.
 *
 * Desync safety: the hint is given a shorter lifetime than the JWT, so if the two ever
 * drift the hint expires first and the next load re-establishes the truth. Any 401 from
 * an authenticated endpoint also clears it (see `apiClient`).
 */

export const SESSION_HINT_COOKIE = "has_session";

/** Deliberately shorter than the JWT lifetime (1d) so a desync self-heals rather than sticking. */
export const SESSION_HINT_MAX_AGE_SECONDS = 60 * 60 * 12; // 12h

export function hasSessionHint(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.split("; ").some((c) => c.startsWith(`${SESSION_HINT_COOKIE}=1`));
}

export function setSessionHint(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${SESSION_HINT_COOKIE}=1; path=/; max-age=${SESSION_HINT_MAX_AGE_SECONDS}; samesite=lax`;
}

export function clearSessionHint(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${SESSION_HINT_COOKIE}=; path=/; max-age=0; samesite=lax`;
}
