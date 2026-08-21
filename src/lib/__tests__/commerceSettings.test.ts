import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const findOne = vi.fn();

vi.mock("../dbConnect", () => ({ default: vi.fn() }));
vi.mock("@/models/CmsContent", () => ({
  default: { findOne: (...a: unknown[]) => findOne(...a) },
}));

const lean = (value: unknown) => ({ lean: () => Promise.resolve(value) });

import {
  getCommerceSettings,
  getAdvanceBalanceTopUpAvailability,
  DEFAULT_COMMERCE_SETTINGS,
  RECHARGE_UNAVAILABLE_MESSAGE,
  RECHARGE_UNAVAILABLE_STAFF_MESSAGE,
} from "../commerceSettings";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  process.env.RAZORPAY_KEY_ID = "rzp_test_key";
  process.env.RAZORPAY_KEY_SECRET = "secret";
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("getCommerceSettings", () => {
  it("defaults Advance Balance online top-up to on when never saved", async () => {
    // An existing installation that upgrades must not silently lose a payment method its
    // customers were already using.
    findOne.mockReturnValue(lean(null));

    const settings = await getCommerceSettings();

    expect(settings.enableWalletOnlineRecharge).toBe(true);
    expect(settings).toEqual(DEFAULT_COMMERCE_SETTINGS);
  });

  it("reads a saved value", async () => {
    findOne.mockReturnValue(lean({ value: { enableWalletOnlineRecharge: false } }));

    const settings = await getCommerceSettings();

    expect(settings.enableWalletOnlineRecharge).toBe(false);
  });

  it("fills only the absent keys, keeping the saved ones", async () => {
    findOne.mockReturnValue(lean({ value: { enableCod: false } }));

    const settings = await getCommerceSettings();

    expect(settings.enableCod).toBe(false);
    expect(settings.enableOnlinePayment).toBe(true);
    expect(settings.enableWalletOnlineRecharge).toBe(true);
  });

  it("ignores a non-boolean stored value rather than coercing it", async () => {
    // A truthy string would otherwise turn "false" into enabled.
    findOne.mockReturnValue(lean({ value: { enableWalletOnlineRecharge: "false" } }));

    const settings = await getCommerceSettings();

    expect(settings.enableWalletOnlineRecharge).toBe(true);
  });

  it("falls back to defaults when the read fails, rather than throwing", async () => {
    // A CMS outage must not take payments down. The defaults are the permissive ones, so the
    // worst case is a switch appearing on again — better than a checkout with no methods.
    findOne.mockImplementation(() => {
      throw new Error("mongo unreachable");
    });

    const settings = await getCommerceSettings();

    expect(settings).toEqual(DEFAULT_COMMERCE_SETTINGS);
  });

  it("coerces a numeric tax rate stored as a string", async () => {
    findOne.mockReturnValue(lean({ value: { defaultTaxRate: "12" } }));

    expect((await getCommerceSettings()).defaultTaxRate).toBe(12);
  });
});

describe("getAdvanceBalanceTopUpAvailability", () => {
  it("is available when switched on and the gateway is configured", async () => {
    findOne.mockReturnValue(lean({ value: { enableWalletOnlineRecharge: true } }));

    expect(await getAdvanceBalanceTopUpAvailability()).toEqual({ available: true, reason: "ok" });
  });

  it("reports the admin switch when it is off", async () => {
    findOne.mockReturnValue(lean({ value: { enableWalletOnlineRecharge: false } }));

    expect(await getAdvanceBalanceTopUpAvailability()).toEqual({
      available: false,
      reason: "disabled_by_admin",
    });
  });

  it("reports missing keys separately from the switch", async () => {
    // The distinction matters when explaining a disabled button: an admin can fix a switch
    // they turned off, but only a developer can fix missing gateway keys.
    findOne.mockReturnValue(lean({ value: { enableWalletOnlineRecharge: true } }));
    delete process.env.RAZORPAY_KEY_ID;

    expect(await getAdvanceBalanceTopUpAvailability()).toEqual({
      available: false,
      reason: "gateway_not_configured",
    });
  });

  it("blames the admin switch first when both are wrong", async () => {
    // The actionable cause, reported to the person who can act on it.
    findOne.mockReturnValue(lean({ value: { enableWalletOnlineRecharge: false } }));
    delete process.env.RAZORPAY_KEY_SECRET;

    expect((await getAdvanceBalanceTopUpAvailability()).reason).toBe("disabled_by_admin");
  });
});

describe("unavailable messages", () => {
  it("has customer text for every reason", () => {
    for (const reason of ["disabled_by_admin", "gateway_not_configured"]) {
      expect(RECHARGE_UNAVAILABLE_MESSAGE[reason], reason).toBeTruthy();
    }
  });

  it("never leaks configuration detail to a customer", () => {
    // A customer cannot act on "Razorpay keys are missing" and should not be shown it.
    for (const text of Object.values(RECHARGE_UNAVAILABLE_MESSAGE)) {
      expect(text.toLowerCase()).not.toContain("razorpay");
      expect(text.toLowerCase()).not.toContain("settings");
      expect(text.toLowerCase()).not.toContain("key");
    }
  });

  it("tells a customer what to do instead", () => {
    for (const text of Object.values(RECHARGE_UNAVAILABLE_MESSAGE)) {
      expect(text.toLowerCase()).toContain("contact us");
    }
  });

  it("names the actual cause for staff, who can act on it", () => {
    expect(RECHARGE_UNAVAILABLE_STAFF_MESSAGE.disabled_by_admin).toMatch(/Settings/);
    expect(RECHARGE_UNAVAILABLE_STAFF_MESSAGE.gateway_not_configured).toMatch(/Razorpay/);
  });

  it("points staff at the offline route as the fallback", () => {
    for (const text of Object.values(RECHARGE_UNAVAILABLE_STAFF_MESSAGE)) {
      expect(text).toMatch(/Add Funds Offline/);
    }
  });
});
