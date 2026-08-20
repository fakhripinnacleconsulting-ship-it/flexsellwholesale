import { ApiError } from "@/lib/apiClient";
import { formatPrice } from "@/lib/utils";

/**
 * Turning a failed payment into something the person in front of the screen can act on.
 *
 * Every payment surface used to do `err.message || "Could not record the payment"`, which
 * produced toasts like **"Insufficient Business Wallet Balance"** — true, and useless: it
 * does not say by how much, and it does not say what happened to the order that was just
 * created. Several also surfaced raw server text such as *"Order validation failed:
 * paymentMethod: `Business Wallet` is not a valid enum value"*, which means nothing to a
 * salesperson.
 *
 * The server sends the numbers (`shortfallAmount`, `availableAmount`, `requiredAmount`) on
 * `ApiError.info`, so the shortfall is stated as money rather than left to be inferred.
 */

interface PaymentErrorBody {
  code?: string;
  message?: string;
  walletType?: "store" | "business";
  requiredAmount?: number;
  availableAmount?: number;
  shortfallAmount?: number;
}

function bodyOf(err: unknown): PaymentErrorBody {
  if (err instanceof ApiError && err.info && typeof err.info === "object") {
    return err.info as PaymentErrorBody;
  }
  return {};
}

/** The server's own wording, or a plain fallback — never an empty toast. */
function messageOf(err: unknown, fallback: string): string {
  const raw = err instanceof Error ? err.message : "";
  if (!raw) return fallback;

  /**
   * A Mongoose validation message is a developer artifact, not a sentence for a user. It
   * reaches the client whenever a route lets a model error escape, and reads as gibberish to
   * anyone who does not know the schema.
   */
  if (/validation failed:|is not a valid enum value|Cast to \w+ failed/i.test(raw)) {
    return fallback;
  }
  return raw;
}

/**
 * What to tell the user when a payment could not be taken.
 *
 * `documentNote` is appended when the attempt already created something — a receipt and its
 * order survive a failed settlement, and saying so is the difference between "try again" and
 * "did that go through?".
 */
export function describePaymentFailure(
  err: unknown,
  options: { fallback?: string; documentNote?: string } = {}
): string {
  const info = bodyOf(err);
  const fallback = options.fallback || "The payment could not be completed.";
  const parts: string[] = [];

  if (info.code === "INSUFFICIENT_BALANCE") {
    const wallet = info.walletType === "business" ? "Business Wallet" : "Store Wallet";
    if (typeof info.shortfallAmount === "number" && typeof info.availableAmount === "number") {
      parts.push(
        `${wallet} is short by ${formatPrice(info.shortfallAmount)} — ` +
          `it holds ${formatPrice(info.availableAmount)} of the ${formatPrice(info.requiredAmount ?? 0)} needed.`
      );
      parts.push("Add funds to the wallet, or choose another payment method.");
    } else {
      parts.push(messageOf(err, `${wallet} does not have enough balance for this payment.`));
      parts.push("Add funds to the wallet, or choose another payment method.");
    }
  } else if (info.code === "USE_SETTLE_ENDPOINT" || info.code === "USE_WALLET_ROUTE") {
    parts.push("This payment has to be recorded through the payment action so the money actually moves.");
  } else if (info.code === "GATEWAY_SETTLES_ITSELF") {
    parts.push("An online payment cannot be recorded by hand — it settles itself once the customer pays.");
  } else {
    parts.push(messageOf(err, fallback));
  }

  if (options.documentNote) parts.push(options.documentNote);

  return parts.join(" ");
}
