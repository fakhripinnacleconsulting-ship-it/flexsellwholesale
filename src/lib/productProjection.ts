/**
 * Fields dropped from product listing payloads.
 *
 * Deliberately an EXCLUSION list, not an inclusion list: a field missing from an
 * inclusion list fails silently at runtime in whichever component happens to read it.
 * Excluding by name means anything not listed here keeps flowing through untouched.
 *
 * Each exclusion is verified unused on listing/card paths:
 *  - aPlusContent  -> rendered only on the product detail page, from the full document
 *  - seo*          -> consumed by generateMetadata server-side, never by a card
 *  - barcodeImage  -> admin barcode sheets only
 *
 * `description` is intentionally NOT excluded: SearchResults scores against it
 * client-side, so dropping it would quietly change search ranking.
 *
 * Shared by the /api/products list endpoint and productService's server branch so the two
 * cannot drift — a projection applied in one place only is how a "slimmed" payload ends
 * up still shipping the heavy fields.
 */
export const PRODUCT_LIST_EXCLUDED_FIELDS = [
  "-aPlusContent",
  "-seoTitle",
  "-seoDescription",
  "-seoKeywords",
  "-barcodeImage",
  "-colorVariants.subVariants.barcodeImage",
].join(" ");
