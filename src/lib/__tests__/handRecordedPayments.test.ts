import { describe, it, expect } from "vitest";

/**
 * The rule that decides whether a payment may be *asserted* or has to be *proven*.
 *
 * Three routes independently decide this — `/api/orders`, `/api/orders/public` and
 * `/api/orders/[id]/status` — and each of them writes `paymentStatus: "Paid"` straight onto
 * an order. Getting it wrong in any one of them hands out free orders:
 *
 *   - **Razorpay** was accepted with a hand-typed reference, so any plausible-looking string
 *     settled an order with no money moved and no signature to check.
 *   - **A Advance Balance** was accepted the same way, marking an order paid against a balance that
 *     was never read, let alone debited.
 *
 * The lists live in the routes, so this suite pins the rule itself rather than importing an
 * abstraction that does not exist. If a route grows a new method, this is the decision it has
 * to make about it.
 */

/** Mirrors the guard in all three routes. */
const HAND_RECORDABLE_METHODS = ["Cash", "COD", "UPI", "Bank Transfer", "NEFT/RTGS", "Cheque"];
const PROVEN_ONLY_METHODS = ["Razorpay", "Wallet", "Store Wallet", "Business Wallet"];

function isHandRecordable(method: string): boolean {
  return !PROVEN_ONLY_METHODS.includes(method);
}

/** What a route must write, given what the request claimed. */
function effectivePaymentStatus(claimed: string, method: string): string {
  return claimed === "Paid" && !isHandRecordable(method) ? "Pending" : claimed;
}

describe("hand-recorded payments", () => {
  describe("what staff may attest to", () => {
    it.each(HAND_RECORDABLE_METHODS)("accepts %s, which is collected offline", (method) => {
      expect(isHandRecordable(method)).toBe(true);
      expect(effectivePaymentStatus("Paid", method)).toBe("Paid");
    });
  });

  describe("what must be proven instead", () => {
    it("refuses a gateway payment, which carries its own signature", () => {
      expect(isHandRecordable("Razorpay")).toBe(false);
      // Falls through to Pending — the callback or webhook settles it for real.
      expect(effectivePaymentStatus("Paid", "Razorpay")).toBe("Pending");
    });

    it.each(["Wallet", "Store Wallet", "Business Wallet"])(
      "refuses %s, which needs a balance read and a ledger entry",
      (method) => {
        expect(isHandRecordable(method)).toBe(false);
        expect(effectivePaymentStatus("Paid", method)).toBe("Pending");
      }
    );
  });

  describe("the claim itself", () => {
    it("never promotes a pending claim, whatever the method", () => {
      for (const method of [...HAND_RECORDABLE_METHODS, ...PROVEN_ONLY_METHODS]) {
        expect(effectivePaymentStatus("Pending", method)).toBe("Pending");
      }
    });

    it("leaves a failed payment alone rather than downgrading it to pending", () => {
      expect(effectivePaymentStatus("Failed", "Razorpay")).toBe("Failed");
      expect(effectivePaymentStatus("Failed", "Cash")).toBe("Failed");
    });
  });
});
