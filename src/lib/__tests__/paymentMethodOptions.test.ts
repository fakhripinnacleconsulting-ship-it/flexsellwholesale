import { describe, it, expect } from "vitest";
import { PAY_NOW_METHODS, PAY_LATER_METHODS } from "@/hooks/useInvoiceForm";
import {
  ADVANCE_BALANCE_METHODS,
  METHOD_TO_WALLET_TYPE,
  isAdvanceBalanceMethod,
} from "@/lib/advanceBalanceConstants";

/**
 * The create-order form's payment `<select>` is a **controlled** input: its value comes from
 * `effectivePaymentMethod`, which falls back to a default whenever the current method is not in
 * `PAY_NOW_METHODS`.
 *
 * That makes the option values and this list one mechanism, not two. When they disagreed —
 * the options renamed to "Store Advance Balance", the list still saying "Store Wallet" — the
 * fallback produced a string no option carried, so the browser rendered the first entry (Cash)
 * and **choosing either balance did nothing**: the value bounced straight back on every
 * attempt, with no error anywhere.
 *
 * TypeScript cannot catch that; both sides are plain strings. These tests are what catches it.
 */

/** Mirrors `effectivePaymentMethod` in `useInvoiceForm`. */
function resolvePayNow(selected: string, fallback: string): string {
  return PAY_NOW_METHODS.includes(selected) ? selected : fallback;
}

describe("payment method options", () => {
  describe("Pay Now", () => {
    it("offers both balances under their current wording", () => {
      expect(PAY_NOW_METHODS).toContain("Store Advance Balance");
      expect(PAY_NOW_METHODS).toContain("Business Advance Balance");
    });

    it("no longer offers the pre-rename wording, which no option carries", () => {
      expect(PAY_NOW_METHODS).not.toContain("Store Wallet");
      expect(PAY_NOW_METHODS).not.toContain("Business Wallet");
    });

    it("takes its balance entries from the shared constants", () => {
      // The duplication is what drifted. If someone re-types these, this fails.
      expect(PAY_NOW_METHODS).toContain(ADVANCE_BALANCE_METHODS.store);
      expect(PAY_NOW_METHODS).toContain(ADVANCE_BALANCE_METHODS.business);
    });

    it("keeps a chosen balance selected instead of bouncing back to the default", () => {
      // The reported bug, stated directly: picking Business Advance Balance must stick.
      expect(resolvePayNow("Business Advance Balance", ADVANCE_BALANCE_METHODS.business)).toBe(
        "Business Advance Balance"
      );
      expect(resolvePayNow("Store Advance Balance", ADVANCE_BALANCE_METHODS.business)).toBe(
        "Store Advance Balance"
      );
    });

    it("defaults to the Business Advance Balance for staff", () => {
      // "COD" is the initial state and belongs to Pay Later, so the fallback decides.
      expect(resolvePayNow("COD", ADVANCE_BALANCE_METHODS.business)).toBe(
        "Business Advance Balance"
      );
    });

    it("defaults to Cash in the public portal, where balances are hidden", () => {
      expect(resolvePayNow("COD", "Cash")).toBe("Cash");
    });

    it("resolves every offered method to a value the select can actually show", () => {
      // The invariant the bug violated: the fallback must itself be an offered option.
      for (const method of PAY_NOW_METHODS) {
        expect(PAY_NOW_METHODS).toContain(resolvePayNow(method, ADVANCE_BALANCE_METHODS.business));
      }
      expect(PAY_NOW_METHODS).toContain(ADVANCE_BALANCE_METHODS.business);
    });
  });

  describe("the server agrees with the form", () => {
    it("maps every balance the form offers to a real wallet", () => {
      // `/api/invoices/[id]/settle` reads this map. A method the form can send but the map
      // does not know comes back as "Unsupported payment method".
      for (const method of PAY_NOW_METHODS.filter(isAdvanceBalanceMethod)) {
        expect(METHOD_TO_WALLET_TYPE[method]).toMatch(/^(store|business)$/);
      }
    });

    it("recognises the balances as balance payments", () => {
      expect(isAdvanceBalanceMethod("Store Advance Balance")).toBe(true);
      expect(isAdvanceBalanceMethod("Business Advance Balance")).toBe(true);
    });

    it("does not mistake an ordinary method for one", () => {
      for (const method of ["Cash", "UPI", "Bank Transfer", "Razorpay", "COD"]) {
        expect(isAdvanceBalanceMethod(method)).toBe(false);
      }
    });
  });

  describe("Pay Later", () => {
    it("offers no balance — a balance is debited now or not at all", () => {
      expect(PAY_LATER_METHODS.some(isAdvanceBalanceMethod)).toBe(false);
    });

    it("still offers the gateway, which the customer runs from their order page", () => {
      expect(PAY_LATER_METHODS).toContain("Razorpay");
    });
  });
});
