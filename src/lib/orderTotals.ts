/**
 * GST and order-total maths, shared by the order and invoice routes.
 *
 * Both routes previously carried their own copy of `computeOrderTaxDetails`, which is
 * exactly the kind of duplication that lets an invoice total drift away from the order
 * total it is supposed to represent.
 */

export interface HsnSlab {
  hsnCode: string;
  gstRate: number;
  baseAmount: number;
  totalTax: number;
  cgst: number;
  sgst: number;
  igst: number;
}

export interface OrderTaxDetails {
  isIntrastate: boolean;
  baseSubtotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  hsnSlabs: HsnSlab[];
}

interface TaxableItem {
  quantity: number;
  pricePerUnit: number;
  product?: {
    gstRate?: number;
    hsnCode?: string;
    priceIncludesGst?: boolean;
  };
}

const DEFAULT_GST_RATE = 18;
const DEFAULT_HSN_CODE = "3924";

/** Place of supply fallback when nothing is configured. */
export const DEFAULT_SELLER_STATE = "Madhya Pradesh";

/**
 * Resolves the seller's state, which decides CGST+SGST vs IGST.
 *
 * Prefers an explicitly configured state; only falls back to scraping it out of the
 * free-text company address, which is what the order and invoice routes used to do
 * independently.
 */
export function resolveSellerState(companyAddress?: string, configuredState?: string): string {
  const explicit = (configuredState || process.env.SELLER_STATE || "").trim();
  if (explicit) return explicit;

  const scraped = companyAddress?.match(/(?:,\s*)([A-Za-z\s]+?)(?:\s*-\s*\d|$)/)?.[1]?.trim();
  return scraped || DEFAULT_SELLER_STATE;
}

/**
 * Splits each line into base value and tax, then apportions the tax as CGST+SGST
 * (same state) or IGST (interstate), aggregating a per-HSN breakdown for the invoice.
 */
export function computeOrderTaxDetails(
  items: TaxableItem[],
  buyerState: string,
  sellerState: string
): OrderTaxDetails {
  const isIntrastate = (buyerState || "").toLowerCase() === (sellerState || "").toLowerCase();
  const hsnMap: Record<string, HsnSlab> = {};

  let baseSubtotal = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let totalIgst = 0;

  items.forEach((item) => {
    const rate = item.product?.gstRate ?? DEFAULT_GST_RATE;
    const hsn = item.product?.hsnCode ?? DEFAULT_HSN_CODE;
    const isIncl = item.product?.priceIncludesGst ?? true;
    const lineAmount = item.pricePerUnit * item.quantity;

    let itemBase: number;
    let itemTax: number;

    if (isIncl) {
      itemBase = lineAmount / (1 + rate / 100);
      itemTax = lineAmount - itemBase;
    } else {
      itemBase = lineAmount;
      itemTax = itemBase * (rate / 100);
    }

    baseSubtotal += itemBase;

    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    if (isIntrastate) {
      cgst = itemTax / 2;
      sgst = itemTax / 2;
      totalCgst += cgst;
      totalSgst += sgst;
    } else {
      igst = itemTax;
      totalIgst += igst;
    }

    if (!hsnMap[hsn]) {
      hsnMap[hsn] = { hsnCode: hsn, gstRate: rate, baseAmount: 0, totalTax: 0, cgst: 0, sgst: 0, igst: 0 };
    }
    hsnMap[hsn].baseAmount += itemBase;
    hsnMap[hsn].totalTax += itemTax;
    hsnMap[hsn].cgst += cgst;
    hsnMap[hsn].sgst += sgst;
    hsnMap[hsn].igst += igst;
  });

  return {
    isIntrastate,
    baseSubtotal,
    cgst: totalCgst,
    sgst: totalSgst,
    igst: totalIgst,
    hsnSlabs: Object.values(hsnMap),
  };
}

/**
 * GST-inclusive value of the goods alone, before shipping, packaging or discount.
 *
 * This is the basis coupons are judged on — both `minOrderValue` and a percentage discount.
 * The order route used to sum `pricePerUnit * quantity` instead, which only coincides with
 * this for products priced GST-inclusive; for GST-exclusive ones it came out lower than the
 * figure the checkout had validated against, so a coupon accepted at the cart was rejected
 * at submit, or its discount failed the mismatch check.
 *
 * The CGST/SGST-vs-IGST split does not change the sum, so place of supply is irrelevant here.
 */
export function computeGoodsGrossTotal(items: TaxableItem[]): number {
  const t = computeOrderTaxDetails(items, "", "");
  return parseFloat((t.baseSubtotal + t.cgst + t.sgst + t.igst).toFixed(2));
}

/**
 * The amount the customer should actually be charged.
 *
 * Derived entirely from server-verified item prices — never from a client-supplied
 * total — so a tampered checkout payload cannot under-charge the order.
 */
export function computeExpectedOrderTotal(params: {
  taxDetails: Pick<OrderTaxDetails, "baseSubtotal" | "cgst" | "sgst" | "igst">;
  shippingCharge?: number;
  packagingCharge?: number;
  couponDiscount?: number;
}): number {
  const { taxDetails, shippingCharge = 0, packagingCharge = 0, couponDiscount = 0 } = params;

  const gross =
    taxDetails.baseSubtotal +
    taxDetails.cgst +
    taxDetails.sgst +
    taxDetails.igst +
    shippingCharge +
    packagingCharge -
    couponDiscount;

  // A discount larger than the order value must not produce a negative charge.
  return parseFloat(Math.max(0, gross).toFixed(2));
}

/**
 * Rounding tolerance (INR) between the client's total and the server's.
 *
 * The client sums per-line inclusive prices while the server splits base/tax and
 * re-adds them, so sub-rupee drift is expected on multi-line orders. Anything beyond
 * this is tampering or a genuine pricing bug, and the order is rejected.
 */
export const ORDER_TOTAL_TOLERANCE = 1;

export function isOrderTotalAcceptable(expected: number, claimed: number): boolean {
  return Math.abs(expected - claimed) <= ORDER_TOTAL_TOLERANCE;
}
