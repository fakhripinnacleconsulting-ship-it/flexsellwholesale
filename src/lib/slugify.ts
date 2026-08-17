/**
 * The one place a slug is built.
 *
 * Two generators existed before this: the admin product form capped the base at 80 characters,
 * while the bulk importer had **no cap at all**. A long marketing title imported in bulk became
 * a 200-plus character path segment, which broke the product detail page in production while
 * the listing kept working — the listing needs one cache entry, a detail page needs one per URL.
 *
 * Product URLs are now keyed on the id, so a slug is no longer load-bearing there. It still
 * matters for categories, collections, blogs and CMS pages, and an unbounded value is a latent
 * version of the same failure.
 */

/** Hard cap on the readable part. Well inside every filesystem and CDN path-segment limit. */
export const SLUG_MAX_LENGTH = 70;

/**
 * Converts text into a URL-safe slug.
 *
 * Truncation happens **at a word boundary**, not mid-word: cutting `...lint-free-car` at a
 * fixed offset produced `...lint-fr`, and appending a uniqueness suffix to a value already
 * ending in a hyphen is what produced the double hyphens seen in production URLs.
 */
export function slugify(text: string, maxLength: number = SLUG_MAX_LENGTH): string {
  const base = String(text || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (base.length <= maxLength) return base;

  const cut = base.slice(0, maxLength);
  const lastHyphen = cut.lastIndexOf("-");

  // Only fall back to the hard cut when the first "word" is itself longer than the limit.
  const trimmed = lastHyphen > maxLength * 0.5 ? cut.slice(0, lastHyphen) : cut;

  return trimmed.replace(/-+$/g, "");
}

/**
 * A slug guaranteed not to collide, given a way to test existence.
 *
 * Counts up rather than appending a timestamp: `-2` says "the second product with this name",
 * which is legible, whereas `-8808` says nothing and changes on every attempt. It also keeps
 * the result stable if the same title is imported twice.
 */
export async function uniqueSlug(
  text: string,
  exists: (candidate: string) => Promise<boolean>,
  maxLength: number = SLUG_MAX_LENGTH
): Promise<string> {
  const base = slugify(text, maxLength) || "item";

  if (!(await exists(base))) return base;

  for (let n = 2; n < 1000; n += 1) {
    const candidate = `${base}-${n}`;
    if (!(await exists(candidate))) return candidate;
  }

  // A thousand identical titles means something is wrong upstream, but the caller still needs
  // a value it can store rather than an exception at the end of a bulk import.
  return `${base}-${Date.now().toString(36)}`;
}
