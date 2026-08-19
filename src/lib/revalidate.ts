import { revalidatePath, revalidateTag } from "next/cache";

/**
 * On-demand cache invalidation for the storefront.
 *
 * Storefront routes are cached with long revalidate windows (24h) and rely on the
 * helpers below for freshness. Two rules keep ISR writes bounded:
 *
 *  1. Purge only paths that actually render the changed data. A broad purge multiplies
 *     into one ISR write per page as crawlers and users re-request them.
 *  2. Stock is NOT a reason to purge. Order activity changes stock constantly; product
 *     pages read live stock client-side from /api/products/stock instead, which
 *     decouples inventory churn from the HTML cache entirely.
 */

/** Catalog surfaces that list products. Kept in one place so purges stay consistent. */
const PRODUCT_LISTING_PATHS = ["/", "/products"];

export function revalidateStorefront() {
  try {
    revalidatePath("/");
  } catch (err) {
    console.error("revalidateStorefront error:", err);
  }
}

/**
 * Call after a genuine catalog mutation (create / update / delete / bulk import).
 *
 * Do NOT call this for stock movements from the order lifecycle — use
 * revalidateProductStock() instead, which is intentionally a no-op.
 */
export async function revalidateProducts(productIdOrSlug?: string) {
  try {
    for (const path of PRODUCT_LISTING_PATHS) {
      revalidatePath(path);
    }

    // The product's own page. This argument used to be omitted at every call site, so this
    // line never ran — which is why an edit appeared on the catalogue at once and took up to
    // 24 hours to appear on the product's own page.
    if (productIdOrSlug) {
      revalidatePath(`/products/${productIdOrSlug}`);
    }

    /**
     * Category and collection pages, all of them.
     *
     * These were never purged at all, so a new product showed on the home page immediately and
     * on its own category page a day later.
     *
     * Purging *every* slug rather than deriving one from the product's `categoryId` is
     * deliberate, and it is the only approach that is actually correct here:
     *
     *  - a product that **moves** category has to disappear from the old page as well as
     *    appear on the new one;
     *  - a **smart collection**'s membership is a rule, not a list, so there is no id to
     *    derive a path from — the product may now match, or no longer match, and neither is
     *    knowable without re-running the rule.
     *
     * Both sets are small (single digits), so this costs a handful of cache entries.
     */
    const { categorySlugs, collectionSlugs } = await catalogueSlugs();

    for (const slug of categorySlugs) revalidatePath(`/categories/${slug}`);
    for (const slug of collectionSlugs) revalidatePath(`/collections/${slug}`);
  } catch (err) {
    // Never fail a catalogue write because a cache purge failed. The 24h `revalidate` on each
    // page is the backstop, and a stale page is a far smaller problem than a rejected save.
    console.error("revalidateProducts error:", err);
  }
}

/**
 * Slugs of every category and collection, for the purge above.
 *
 * One `dbConnect`, then both reads. They were two independent helpers each opening their own
 * connection concurrently — redundant, and the concurrent dynamic imports also raced the
 * module registry, which made the behaviour awkward to test deterministically.
 *
 * Read straight from the models rather than through the services: those carry mock-mode
 * branches and response shaping a cache purge has no business depending on.
 */
async function catalogueSlugs(): Promise<{ categorySlugs: string[]; collectionSlugs: string[] }> {
  try {
    const dbConnect = (await import("@/lib/dbConnect")).default;
    await dbConnect();

    const Category = (await import("@/models/Category")).default;
    const Collection = (await import("@/models/Collection")).default;

    const [categories, collections] = await Promise.all([
      Category.find({}).select("slug").lean<Array<{ slug?: string }>>(),
      Collection.find({}).select("slug").lean<Array<{ slug?: string }>>(),
    ]);

    const slugsOf = (rows: Array<{ slug?: string }>) =>
      rows.map((r) => r.slug).filter((s): s is string => Boolean(s));

    return { categorySlugs: slugsOf(categories), collectionSlugs: slugsOf(collections) };
  } catch (err) {
    // A purge that cannot list the slugs still purges the listings above; the 24h window is
    // the backstop. Never let this fail the catalogue write that triggered it.
    console.error("revalidateProducts: could not list catalogue slugs:", err);
    return { categorySlugs: [], collectionSlugs: [] };
  }
}

/**
 * Stock changed because of order activity (placement, cancellation, fulfilment, sweep).
 *
 * Deliberately does nothing. Product pages fetch live stock on demand from
 * /api/products/stock, so the cached HTML does not need rebuilding — and rebuilding it
 * on every order was the single largest source of ISR writes.
 *
 * Kept as a named call site so the intent is explicit at each order route rather than
 * looking like someone forgot to invalidate.
 */
export function revalidateProductStock() {
  // no-op by design — see doc comment above.
}

export function revalidateCategories(categoryIdOrSlug?: string) {
  try {
    revalidateTag("categories", "max" as any);
    revalidatePath("/");
    revalidatePath("/categories");
    if (categoryIdOrSlug) {
      revalidatePath(`/categories/${categoryIdOrSlug}`);
    }
  } catch (err) {
    console.error("revalidateCategories error:", err);
  }
}

export function revalidateCollections(collectionIdOrSlug?: string) {
  try {
    revalidateTag("collections", "max" as any);
    revalidatePath("/");
    revalidatePath("/collections");
    if (collectionIdOrSlug) {
      revalidatePath(`/collections/${collectionIdOrSlug}`);
    }
  } catch (err) {
    console.error("revalidateCollections error:", err);
  }
}

/**
 * CMS content changed.
 *
 * Note the layout purge: announcements and the footer are rendered by StorefrontLayout,
 * so they are baked into *every* cached storefront page. A page-level purge of "/" alone
 * would leave them stale everywhere else until the 24h window elapsed.
 */
export function revalidateCms() {
  try {
    revalidateTag("cms-policies", "max" as any);
    revalidateTag("cms-content", "max" as any);
    revalidatePath("/", "layout");
  } catch (err) {
    console.error("revalidateCms error:", err);
  }
}

export function revalidateAdminDashboard() {
  try {
    revalidatePath("/admin");
    revalidatePath("/admin/orders");
  } catch (err) {
    console.error("revalidateAdminDashboard error:", err);
  }
}
