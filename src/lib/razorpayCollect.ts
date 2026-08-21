import { apiClient } from "@/lib/apiClient";
import { openRazorpayCheckout, RazorpayUnavailableError } from "@/lib/razorpayLoader";

/**
 * Collecting an online payment against an existing order — the one client-side path.
 *
 * Every surface that offers "Razorpay" now calls this: the create-order form, the create
 * Tax Invoice form, the receipt pay modal and the dispatch pay modal. Before it existed each
 * of those offered Razorpay beside a free-text "Transaction Ref" box, which is not a payment
 * method — it is a request to *assert* that a payment happened. Any string got through, no
 * money moved, and the resulting Tax Invoice referenced nothing.
 *
 * The sequence here is the same one the storefront checkout uses, and it is the only one
 * that ends in a settled order:
 *
 *   1. `/api/razorpay/order` mints a gateway order **from the stored order's amount**, never
 *      from anything the browser passes, and stamps `razorpayOrderId` onto the order.
 *   2. Razorpay Checkout opens and the payer actually pays.
 *   3. `/api/razorpay/verify` re-computes the HMAC over `order_id|payment_id`. Only if that
 *      matches does `settleOrderPayment` mark the order paid and issue the `INV-` Tax
 *      Invoice through `settleOrderDocuments`.
 *
 * So the amount is always the order's real total, and "paid" always means a verified
 * signature. The webhook is the backstop if the browser dies between 2 and 3.
 */

export interface CollectPaymentInput {
  /** The FlexSell order to collect against. The amount comes from it, server-side. */
  orderId: string;
  /** Prefill only — Razorpay shows these in its form. */
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  /** Shown in the Razorpay modal, e.g. "Receipt REC-01001". */
  description?: string;
}

export type CollectPaymentResult =
  | { status: "paid"; transactionId: string }
  /** The payer closed the modal. Nothing was charged; the order is still payable. */
  | { status: "dismissed" };

/**
 * Opens Razorpay Checkout for an order and resolves once the payment is **verified**.
 *
 * Rejects on a gateway that would not load, a declined payment, or a verification that did
 * not check out — never resolves "paid" on anything less than a matching signature.
 */
export async function collectOrderPaymentOnline(
  input: CollectPaymentInput
): Promise<CollectPaymentResult> {
  const init = await apiClient.post<{
    orderId?: string;
    amount?: number;
    currency?: string;
    error?: string;
  }>("/razorpay/order", { orderId: input.orderId });

  if (!init.orderId) {
    throw new Error(init.error || "Could not start the payment gateway for this order.");
  }

  return new Promise<CollectPaymentResult>((resolve, reject) => {
    /**
     * Razorpay calls exactly one of `handler`, `ondismiss` or `payment.failed`, but a
     * declined payment can be retried inside the same modal — so `payment.failed` is
     * followed by either a retry or a dismiss. This guard makes sure the promise settles
     * once whichever way that goes.
     */
    let settled = false;
    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      fn();
    };

    openRazorpayCheckout(
      {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_placeholder",
        amount: String(init.amount),
        currency: init.currency || "INR",
        name: "FlexSell Wholesale",
        description: input.description || `Payment for order ${input.orderId}`,
        order_id: init.orderId,
        prefill: {
          name: input.customerName || "",
          email: input.customerEmail || "",
          contact: input.customerPhone || "",
        },
        theme: { color: "#10b981" },
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          try {
            const res = await apiClient.post<{ success?: boolean; error?: string }>(
              "/razorpay/verify",
              {
                orderId: input.orderId,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }
            );
            if (!res.success) throw new Error(res.error || "Payment verification failed");
            settle(() => resolve({ status: "paid", transactionId: response.razorpay_payment_id }));
          } catch (err) {
            /**
             * Captured but unverified. The webhook settles it shortly, so this is reported as
             * an error the operator should watch rather than a silent success — but it is
             * explicitly *not* framed as "payment failed", which would be wrong and would
             * invite a second charge.
             */
            settle(() =>
              reject(
                new Error(
                  `${err instanceof Error ? err.message : "Could not confirm the payment"}. ` +
                    "If the customer was debited it will be confirmed automatically in a moment."
                )
              )
            );
          }
        },
        modal: {
          ondismiss: () => settle(() => resolve({ status: "dismissed" })),
        },
      },
      {
        onPaymentFailed: (response) => {
          // Deliberately does not settle: Razorpay keeps the modal open for another attempt,
          // and `ondismiss` fires if they give up. Settling here would strand the retry.
          const failure = response as { error?: { description?: string } };
          console.warn("[Razorpay] Payment attempt failed:", failure.error?.description);
        },
      }
    ).catch((err) => {
      const isLoadFailure = err instanceof RazorpayUnavailableError;
      settle(() =>
        reject(
          new Error(
            isLoadFailure
              ? `${err.message} Check the connection, or collect the payment another way.`
              : (err as Error)?.message || "Could not start the payment gateway"
          )
        )
      );
    });
  });
}
