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
export function revalidateProducts(productIdOrSlug?: string) {
  try {
    revalidateTag("products", "max" as any);
    for (const path of PRODUCT_LISTING_PATHS) {
      revalidatePath(path);
    }
    if (productIdOrSlug) {
      revalidatePath(`/products/${productIdOrSlug}`);
    }
  } catch (err) {
    console.error("revalidateProducts error:", err);
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
