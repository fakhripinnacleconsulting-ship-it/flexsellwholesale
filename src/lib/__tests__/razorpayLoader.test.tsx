/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  loadRazorpayScript,
  openRazorpayCheckout,
  RazorpayUnavailableError,
  __resetRazorpayLoaderForTests,
} from "../razorpayLoader";

/**
 * Regression cover for `TypeError: window.Razorpay is not a constructor`.
 *
 * `react-razorpay` fetched `checkout.js` in a `useEffect` but returned a wrapper class
 * immediately — always truthy, so no `if (!Razorpay)` guard could catch it — and that
 * wrapper's constructor called `new window.Razorpay(...)` straight away. A buyer clicking
 * before the script landed crashed.
 *
 * These assert the property that removes the race: **nothing is constructed until
 * `window.Razorpay` is a function.**
 */

type Win = typeof window & { Razorpay?: unknown };

/** Resolves the pending script tag as the browser would on load/error. */
function settleScript(outcome: "load" | "error") {
  const tag = document.getElementById("razorpay-checkout-js");
  tag?.dispatchEvent(new Event(outcome));
}

function installSdk() {
  (window as Win).Razorpay = vi.fn(function (this: Record<string, unknown>) {
    this.open = vi.fn();
    this.on = vi.fn();
  }) as unknown;
}

describe("razorpayLoader", () => {
  beforeEach(() => {
    __resetRazorpayLoaderForTests();
    document.body.innerHTML = "";
    delete (window as Win).Razorpay;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves without touching the DOM when the SDK is already present", async () => {
    installSdk();
    await expect(loadRazorpayScript()).resolves.toBeTypeOf("function");
    expect(document.getElementById("razorpay-checkout-js")).toBeNull();
  });

  it("injects the script once and resolves when it loads", async () => {
    const pending = loadRazorpayScript();

    const tag = document.getElementById("razorpay-checkout-js") as HTMLScriptElement;
    expect(tag).not.toBeNull();
    expect(tag.src).toContain("checkout.razorpay.com");

    installSdk();
    settleScript("load");

    await expect(pending).resolves.toBeTypeOf("function");
  });

  it("shares one in-flight load between concurrent callers", async () => {
    // Two components can ask at once — the Advance Balance dialog open on the checkout page. Without
    // a shared promise each would append its own tag and race the other.
    const a = loadRazorpayScript();
    const b = loadRazorpayScript();

    expect(document.querySelectorAll("script#razorpay-checkout-js")).toHaveLength(1);

    installSdk();
    settleScript("load");

    await expect(Promise.all([a, b])).resolves.toHaveLength(2);
  });

  it("rejects with a named error when the script fails to load", async () => {
    const pending = loadRazorpayScript();
    settleScript("error");

    // The name is what lets callers tell a blocked gateway from a declined card — the two
    // need different recovery, and in checkout one of them has to release a reserved order.
    await expect(pending).rejects.toBeInstanceOf(RazorpayUnavailableError);
  });

  it("rejects when the script loads but the global never appears", async () => {
    // A privacy extension can serve an empty 200 rather than failing outright.
    const pending = loadRazorpayScript();
    settleScript("load");
    await expect(pending).rejects.toBeInstanceOf(RazorpayUnavailableError);
  });

  it("times out rather than hanging when nothing ever responds", async () => {
    const pending = loadRazorpayScript();
    const assertion = expect(pending).rejects.toBeInstanceOf(RazorpayUnavailableError);
    await vi.advanceTimersByTimeAsync(15_000);
    await assertion;
  });

  it("allows a fresh attempt after a failure", async () => {
    const first = loadRazorpayScript();
    settleScript("error");
    await expect(first).rejects.toBeInstanceOf(RazorpayUnavailableError);

    // A dead promise must not be cached — the buyer's second click has to be able to work.
    document.body.innerHTML = "";
    const second = loadRazorpayScript();
    installSdk();
    settleScript("load");
    await expect(second).resolves.toBeTypeOf("function");
  });

  describe("openRazorpayCheckout", () => {
    it("does not construct anything until the SDK is a function", async () => {
      const pending = openRazorpayCheckout({ key: "rzp_test" });

      // The exact moment the old code crashed: script requested, global still absent.
      expect((window as Win).Razorpay).toBeUndefined();

      installSdk();
      settleScript("load");
      await pending;

      expect((window as Win).Razorpay).toHaveBeenCalledWith({ key: "rzp_test" });
    });

    it("registers a payment.failed handler when one is given", async () => {
      const onPaymentFailed = vi.fn();
      const pending = openRazorpayCheckout({ key: "rzp_test" }, { onPaymentFailed });

      installSdk();
      settleScript("load");
      await pending;

      const instance = ((window as Win).Razorpay as unknown as { mock: { instances: Array<{ on: ReturnType<typeof vi.fn>; open: ReturnType<typeof vi.fn> }> } }).mock.instances[0];
      expect(instance.on).toHaveBeenCalledWith("payment.failed", onPaymentFailed);
      expect(instance.open).toHaveBeenCalled();
    });
  });
});
