import { describe, it, expect } from "vitest";

/**
 * Two rules that were each broken by an absent filter, and are easy to break again because
 * nothing about them is type-checked.
 *
 *  1. **A withdrawn product is invisible to the public.** `/api/products` queried
 *     `Product.find({})`, so deactivating removed the product from nowhere — it stayed on the
 *     catalogue and on its own URL. `searchService` already filtered, so it vanished from
 *     search while remaining browsable, which is how the gap went unnoticed.
 *  2. **Withdrawn still means sellable by staff.** Deactivating is *withdraw from sale*, not
 *     *delete*: a back-order or an agreed price still has to be invoiceable. So the filter is a
 *     default with a staff opt-in, not a blanket exclusion.
 *
 * These pin the filter shape rather than the route, which is what actually drifted.
 */

/** Mirrors the catalogue filter in `/api/products` and `/api/products/slug/[slug]`. */
function catalogueFilter(includeInactive: boolean): Record<string, unknown> {
  return includeInactive ? {} : { isActive: { $ne: false } };
}

/** Would a product with this `isActive` value be returned by the filter? */
function isVisible(filter: Record<string, unknown>, isActive: boolean | undefined): boolean {
  const rule = filter.isActive as { $ne?: boolean } | undefined;
  if (!rule) return true;
  return isActive !== rule.$ne;
}

describe("catalogue visibility", () => {
  describe("the public catalogue", () => {
    const publicFilter = catalogueFilter(false);

    it("hides a product that was deactivated", () => {
      expect(isVisible(publicFilter, false)).toBe(false);
    });

    it("shows an active product", () => {
      expect(isVisible(publicFilter, true)).toBe(true);
    });

    /**
     * `$ne: false` rather than `=== true`, deliberately.
     *
     * The schema defaults `isActive` to true, but documents written before the field existed
     * carry no value at all. Treating a missing field as "withdrawn" would empty the catalogue
     * of exactly the oldest products.
     */
    it("shows a product written before the field existed", () => {
      expect(isVisible(publicFilter, undefined)).toBe(true);
    });
  });

  describe("the staff opt-in", () => {
    const staffFilter = catalogueFilter(true);

    it("returns withdrawn products so they stay invoiceable", () => {
      expect(isVisible(staffFilter, false)).toBe(true);
      expect(isVisible(staffFilter, true)).toBe(true);
      expect(isVisible(staffFilter, undefined)).toBe(true);
    });

    it("applies no isActive condition at all", () => {
      expect(staffFilter).not.toHaveProperty("isActive");
    });
  });
});

/**
 * Stock guards on document creation.
 *
 * `/api/orders/public` deducted stock with no `$gte` condition and no `modifiedCount` check,
 * inside a `catch` that only logged — so the decrement **drove the count negative**, the order
 * was confirmed, and nothing reported it. The other two routes had guarded this for a while;
 * this one had drifted.
 */
function canReserve(available: number, requested: number): boolean {
  // Mirrors `$elemMatch: { …, stock: { $gte: qty } }` — the read and the write as one operation.
  return available >= requested;
}

describe("stock reservation", () => {
  it("allows a reservation the stock covers", () => {
    expect(canReserve(10, 3)).toBe(true);
    expect(canReserve(3, 3)).toBe(true);
  });

  it("refuses one it does not, rather than going negative", () => {
    expect(canReserve(2, 3)).toBe(false);
    expect(canReserve(0, 1)).toBe(false);
  });

  it("refuses when stock is already negative from an earlier oversell", () => {
    // Historic rows exist from before the guard. They must not be drawn down further.
    expect(canReserve(-4, 1)).toBe(false);
  });

  /**
   * A quote reserves nothing, which is why `/api/invoices` skips stock for `type === "quote"`
   * and the create form only blocks the line for the other document types.
   */
  it("does not apply to quotes", () => {
    const blocksLine = (docType: string, available: number, qty: number) =>
      docType !== "quote" && available < qty;

    expect(blocksLine("receipt", 0, 1)).toBe(true);
    expect(blocksLine("invoice", 0, 1)).toBe(true);
    expect(blocksLine("quote", 0, 1)).toBe(false);
  });
});
