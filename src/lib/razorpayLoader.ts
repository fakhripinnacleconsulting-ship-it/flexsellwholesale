/**
 * Loading Razorpay Checkout, and only then constructing it.
 *
 * `react-razorpay`'s hook starts fetching `checkout.js` in a `useEffect` — after mount — but
 * hands back a **static wrapper class** immediately, the same reference whatever the load
 * state. Its constructor does `new window.Razorpay(options)` straight away, so a buyer who
 * clicked before the script landed got:
 *
 *     TypeError: window.Razorpay is not a constructor
 *
 * A `if (!Razorpay)` guard cannot catch that: the wrapper class is always truthy. The only
 * thing worth checking is `window.Razorpay`, and the only useful response is to **wait** for
 * it rather than refuse.
 */

const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";
const SCRIPT_ID = "razorpay-checkout-js";

/**
 * Long enough for a slow mobile connection, short enough that a buyer staring at a spinner
 * gets an explanation instead. An ad-blocker usually fails fast, but not always — some drop
 * the request silently, and without this the promise would never settle.
 */
const LOAD_TIMEOUT_MS = 15_000;

/** Distinguishes "the gateway never loaded" from "the payment was declined". */
export class RazorpayUnavailableError extends Error {
  constructor(message = "The payment gateway could not be loaded.") {
    super(message);
    this.name = "RazorpayUnavailableError";
  }
}

interface RazorpayConstructor {
  new (options: Record<string, unknown>): {
    open: () => void;
    on: (event: string, handler: (response: unknown) => void) => void;
  };
}

function existingSdk(): RazorpayConstructor | null {
  if (typeof window === "undefined") return null;
  const sdk = (window as unknown as { Razorpay?: unknown }).Razorpay;
  // `typeof === "function"` rather than a truthiness check: the tag can be present and the
  // global still undefined while the body is being parsed.
  return typeof sdk === "function" ? (sdk as RazorpayConstructor) : null;
}

/**
 * Shared across concurrent callers.
 *
 * Two components can ask at once — a buyer with the Advance Balance dialog open on the checkout page.
 * Without this each would append its own tag and race the other.
 */
let inFlight: Promise<RazorpayConstructor> | null = null;

export function loadRazorpayScript(): Promise<RazorpayConstructor> {
  const already = existingSdk();
  if (already) return Promise.resolve(already);

  if (typeof window === "undefined") {
    return Promise.reject(new RazorpayUnavailableError("Payments are only available in the browser."));
  }

  if (inFlight) return inFlight;

  inFlight = new Promise<RazorpayConstructor>((resolve, reject) => {
    let settled = false;

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      fn();
    };

    const timer = window.setTimeout(() => {
      finish(() => {
        // Let a later attempt start clean rather than returning this dead promise forever.
        inFlight = null;
        reject(
          new RazorpayUnavailableError(
            "The payment gateway is taking too long to respond. Please check your connection and try again."
          )
        );
      });
    }, LOAD_TIMEOUT_MS);

    const onReady = () => {
      const sdk = existingSdk();
      if (sdk) {
        finish(() => resolve(sdk));
        return;
      }
      // The tag loaded but the global is missing — the response was intercepted or replaced.
      finish(() => {
        inFlight = null;
        reject(new RazorpayUnavailableError());
      });
    };

    const onFailed = () => {
      finish(() => {
        inFlight = null;
        reject(
          new RazorpayUnavailableError(
            "The payment gateway could not be reached. An ad blocker or privacy extension may be blocking it."
          )
        );
      });
    };

    // Reuse a tag another mount already added rather than adding a second one.
    const existingTag = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existingTag) {
      existingTag.addEventListener("load", onReady);
      existingTag.addEventListener("error", onFailed);
      return;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = CHECKOUT_SRC;
    script.async = true;
    script.addEventListener("load", onReady);
    script.addEventListener("error", onFailed);
    document.body.appendChild(script);
  });

  return inFlight;
}

export interface RazorpayCheckoutHandlers {
  /** Razorpay's own `payment.failed` event — a declined card, not a loading problem. */
  onPaymentFailed?: (response: unknown) => void;
}

/**
 * Waits for the SDK, then opens Checkout.
 *
 * The await is the entire fix: nothing is constructed until `window.Razorpay` is a function.
 * A rejection here is always a *loading* failure — callers can tell it apart from a declined
 * payment by the error name, which matters because the two need different recovery.
 */
export async function openRazorpayCheckout(
  options: Record<string, unknown>,
  handlers: RazorpayCheckoutHandlers = {}
): Promise<void> {
  const Razorpay = await loadRazorpayScript();

  const instance = new Razorpay(options);

  if (handlers.onPaymentFailed) {
    instance.on("payment.failed", handlers.onPaymentFailed);
  }

  instance.open();
}

/** Test seam — resets the shared promise between cases. */
export function __resetRazorpayLoaderForTests(): void {
  inFlight = null;
}
