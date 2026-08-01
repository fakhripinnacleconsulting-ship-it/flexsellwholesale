import { describe, it, expect } from "vitest";
import crypto from "crypto";
import { verifyPaymentSignature, verifyWebhookSignature } from "../razorpayPayment";

const KEY_SECRET = "test_secret_key";

function signCheckout(orderId: string, paymentId: string, secret = KEY_SECRET) {
  return crypto.createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
}

function signWebhook(body: string, secret = KEY_SECRET) {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

describe("verifyPaymentSignature", () => {
  const razorpayOrderId = "order_ABC123";
  const razorpayPaymentId = "pay_XYZ789";

  it("accepts a genuine signature", () => {
    const signature = signCheckout(razorpayOrderId, razorpayPaymentId);

    expect(
      verifyPaymentSignature({ razorpayOrderId, razorpayPaymentId, signature, keySecret: KEY_SECRET })
    ).toBe(true);
  });

  it("rejects a forged signature", () => {
    expect(
      verifyPaymentSignature({
        razorpayOrderId,
        razorpayPaymentId,
        signature: "f".repeat(64),
        keySecret: KEY_SECRET,
      })
    ).toBe(false);
  });

  it("rejects a signature minted with a different secret", () => {
    const signature = signCheckout(razorpayOrderId, razorpayPaymentId, "attacker_secret");

    expect(
      verifyPaymentSignature({ razorpayOrderId, razorpayPaymentId, signature, keySecret: KEY_SECRET })
    ).toBe(false);
  });

  it("rejects a signature bound to a different order", () => {
    // A signature captured from a cheaper order must not settle this one.
    const signature = signCheckout("order_CHEAP", razorpayPaymentId);

    expect(
      verifyPaymentSignature({ razorpayOrderId, razorpayPaymentId, signature, keySecret: KEY_SECRET })
    ).toBe(false);
  });

  it("rejects a signature bound to a different payment", () => {
    const signature = signCheckout(razorpayOrderId, "pay_OTHER");

    expect(
      verifyPaymentSignature({ razorpayOrderId, razorpayPaymentId, signature, keySecret: KEY_SECRET })
    ).toBe(false);
  });

  it("rejects an empty signature without throwing", () => {
    expect(
      verifyPaymentSignature({
        razorpayOrderId,
        razorpayPaymentId,
        signature: "",
        keySecret: KEY_SECRET,
      })
    ).toBe(false);
  });

  it("rejects a truncated signature without throwing", () => {
    // Length mismatch would make a naive timingSafeEqual throw rather than return false.
    const signature = signCheckout(razorpayOrderId, razorpayPaymentId).slice(0, 10);

    expect(
      verifyPaymentSignature({ razorpayOrderId, razorpayPaymentId, signature, keySecret: KEY_SECRET })
    ).toBe(false);
  });
});

describe("verifyWebhookSignature", () => {
  const body = JSON.stringify({
    event: "payment.captured",
    payload: { payment: { entity: { id: "pay_1", order_id: "order_1" } } },
  });

  it("accepts a genuine webhook signature", () => {
    expect(verifyWebhookSignature(body, signWebhook(body), KEY_SECRET)).toBe(true);
  });

  it("rejects a body that was altered after signing", () => {
    const signature = signWebhook(body);
    const tampered = body.replace("pay_1", "pay_ATTACKER");

    expect(verifyWebhookSignature(tampered, signature, KEY_SECRET)).toBe(false);
  });

  it("rejects a signature minted with the wrong secret", () => {
    expect(verifyWebhookSignature(body, signWebhook(body, "wrong_secret"), KEY_SECRET)).toBe(false);
  });

  it("rejects an empty signature without throwing", () => {
    expect(verifyWebhookSignature(body, "", KEY_SECRET)).toBe(false);
  });
});
