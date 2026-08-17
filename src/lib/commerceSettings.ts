import dbConnect from "./dbConnect";
import CmsContent from "@/models/CmsContent";

/**
 * Commerce switches an admin controls from Settings → Commerce.
 *
 * Read server-side wherever the setting must be *enforced*, not merely reflected. Hiding a
 * payment button is presentation; refusing the route is the control. Both read from here so
 * they can never disagree.
 */
export interface CommerceSettings {
  defaultTaxRate: number;
  /** Cash on Delivery at checkout. */
  enableCod: boolean;
  /** Razorpay at checkout. */
  enableOnlinePayment: boolean;
  /**
   * Razorpay for **wallet top-ups**, for customers and staff alike.
   *
   * Deliberately separate from `enableOnlinePayment`: a business may want card payments at
   * checkout while keeping prepaid balance to bank transfers it can reconcile by hand — and
   * the reverse, once the wallet is trusted and COD is being retired.
   */
  enableWalletOnlineRecharge: boolean;
}

/**
 * Defaults when the setting has never been saved.
 *
 * Wallet online recharge defaults to **on**: an existing installation that upgrades should
 * not silently lose a payment method its customers were already using.
 */
export const DEFAULT_COMMERCE_SETTINGS: CommerceSettings = {
  defaultTaxRate: 18,
  enableCod: true,
  enableOnlinePayment: true,
  enableWalletOnlineRecharge: true,
};

/**
 * Reads the settings, filling any absent key from the defaults.
 *
 * Never throws. A CMS read failure must not take payments down — the defaults are the
 * permissive ones, so the worst case is that a switch an admin turned off appears on again
 * until the database is reachable. That is a better failure than a checkout with no payment
 * methods at all.
 */
export async function getCommerceSettings(): Promise<CommerceSettings> {
  try {
    await dbConnect();
    const doc = await CmsContent.findOne({ key: "commerceSettings" }).lean() as
      | { value?: Partial<CommerceSettings> }
      | null;

    const stored = doc?.value || {};

    return {
      defaultTaxRate: numberOr(stored.defaultTaxRate, DEFAULT_COMMERCE_SETTINGS.defaultTaxRate),
      enableCod: boolOr(stored.enableCod, DEFAULT_COMMERCE_SETTINGS.enableCod),
      enableOnlinePayment: boolOr(
        stored.enableOnlinePayment,
        DEFAULT_COMMERCE_SETTINGS.enableOnlinePayment
      ),
      enableWalletOnlineRecharge: boolOr(
        stored.enableWalletOnlineRecharge,
        DEFAULT_COMMERCE_SETTINGS.enableWalletOnlineRecharge
      ),
    };
  } catch (err) {
    console.error("[Commerce] Failed to read settings, using defaults:", err);
    return DEFAULT_COMMERCE_SETTINGS;
  }
}

/**
 * Whether online wallet top-up is available at all.
 *
 * Two independent conditions, and the distinction matters when explaining a disabled button:
 * an admin can fix a switch they turned off, but only a developer can fix missing gateway
 * keys.
 */
export async function getWalletRechargeAvailability(): Promise<{
  available: boolean;
  reason: "ok" | "disabled_by_admin" | "gateway_not_configured";
}> {
  const settings = await getCommerceSettings();

  if (!settings.enableWalletOnlineRecharge) {
    return { available: false, reason: "disabled_by_admin" };
  }
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    return { available: false, reason: "gateway_not_configured" };
  }
  return { available: true, reason: "ok" };
}

/**
 * Re-exported from the client-safe constants module.
 *
 * This file imports mongoose, so a client component importing a message from here would pull
 * the driver into the browser bundle — which fails on `async_hooks`. Server code may keep
 * importing them from either place; client code must use walletConstants.
 */
export { RECHARGE_UNAVAILABLE_MESSAGE, RECHARGE_UNAVAILABLE_STAFF_MESSAGE } from "./walletConstants";

function boolOr(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function numberOr(value: unknown, fallback: number): number {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
}
