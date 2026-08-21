"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useCartStore } from "@/stores/cartStore";
import { useOrderStore } from "@/stores/orderStore";
import { useProductStore } from "@/stores/productStore";
import { useToastStore } from "@/stores/toastStore";
import { customerService } from "@/services/customerService";
import { couponService } from "@/services/couponService";
import { useAuthStore } from "@/stores/authStore";
import { shippingService } from "@/services/shippingService";
import { apiClient } from "@/lib/apiClient";
import { INDIAN_STATES } from "@/lib/constants";
import { ShippingForm } from "./checkout/ShippingForm";
import { PaymentSection } from "./checkout/PaymentSection";
import { OrderSummary } from "./checkout/OrderSummary";
import { CouponInput } from "./checkout/CouponInput";
import { Card } from "@/components/ui/Card";
import { openRazorpayCheckout } from "@/lib/razorpayLoader";
import * as advanceBalanceService from "@/services/advanceBalanceService";
import type { CheckoutPaymentMethod } from "@/components/storefront/checkout/PaymentSection";
import { SuggestedProductsCarousel } from "./SuggestedProductsCarousel";
import { trackBeginCheckout, trackPurchase } from "@/lib/gtm";

export function CheckoutView() {
  const router = useRouter();
  const { addToast } = useToastStore();
  const { items, buyerState, setBuyerState, clearCart, getTaxDetails, hydrateProducts, getCartSubtotal, delegatedCustomerId } = useCartStore();
  const { createOrder } = useOrderStore();
  const products = useProductStore((state) => state.products);
  const [shippingConfig, setShippingConfig] = React.useState<any>(null);

  React.useEffect(() => {
    const initCartProducts = async () => {
      if (products.length === 0) {
        await useProductStore.getState().initializeProducts();
      }
      hydrateProducts();
    };
    initCartProducts();
  }, [products.length, hydrateProducts]);

  const taxDetails = React.useMemo(() => {
    return getTaxDetails();
  }, [items, buyerState, getTaxDetails]);

  const { isIntrastate, baseSubtotal, totalCgst, totalSgst, totalIgst, grandTotal, hsnBreakdown } = taxDetails;

  // Form states
  const [email, setEmail] = React.useState("");
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [company, setCompany] = React.useState("");
  const [gstin, setGstin] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [apartment, setApartment] = React.useState("");
  const [city, setCity] = React.useState("");
  const [state, setState] = React.useState(INDIAN_STATES[0]);
  const [pinCode, setPinCode] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const [paymentMethod, setPaymentMethod] = React.useState<CheckoutPaymentMethod>("Razorpay");
  // Store Advance Balance balance in rupees, or null while unknown / not applicable.
  const [storeAdvanceBalance, setStoreAdvanceBalance] = React.useState<number | null>(null);
  // Business Advance Balance balance in rupees, or null while unknown / not applicable.
  const [businessAdvanceBalance, setBusinessAdvanceBalance] = React.useState<number | null>(null);
  const [enableCod, setEnableCod] = React.useState(true);
  const [enableOnlinePayment, setEnableOnlinePayment] = React.useState(true);
  const [isPaying, setIsPaying] = React.useState(false);

  const [existingOrderId, setExistingOrderId] = React.useState<string | null>(null);

  // Coupon states
  const [couponCode, setCouponCode] = React.useState("");
  const [appliedCoupon, setAppliedCoupon] = React.useState<any>(null);
  const [couponDiscount, setCouponDiscount] = React.useState(0);
  const [isValidatingCoupon, setIsValidatingCoupon] = React.useState(false);

  React.useEffect(() => {
    setExistingOrderId(null);
  }, [items, grandTotal, email, firstName, lastName, company, address, city, state, pinCode, phone, paymentMethod, appliedCoupon]);

  /**
   * The payable total, at component scope.
   *
   * The submit handler computes this again from the same helpers; it is duplicated here
   * because the Advance Balance option has to compare against the *final* figure. Comparing against
   * the pre-shipping total would show "covers this order" and then fail at payment once
   * shipping pushed it over — the worst possible moment to discover a shortfall.
   */
  const payableTotal = React.useMemo(() => {
    const { calculateShippingByWeight, calculateEffectiveUnitWeightGrams } = require("@/lib/priceTierHelper");
    const { calculateTotalShippingCharge } = require("@/lib/shippingHelper");
    const shipping = calculateTotalShippingCharge(
      items,
      shippingConfig,
      calculateShippingByWeight,
      calculateEffectiveUnitWeightGrams
    );
    return Math.max(0, grandTotal + shipping - couponDiscount);
  }, [items, shippingConfig, grandTotal, couponDiscount]);

  // Admin delegation states
  const [currentUser, setCurrentUser] = React.useState<any>(null);
  const [customersList, setCustomersList] = React.useState<any[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = React.useState("");
  const [savedAddresses, setSavedAddresses] = React.useState<any[]>([]);

  React.useEffect(() => {
    if (delegatedCustomerId && !selectedCustomerId) {
      setSelectedCustomerId(delegatedCustomerId);
    }
  }, [delegatedCustomerId]);

  // Dropshipping redirect guard
  const customer = useAuthStore((state: any) => state.customer);
  const isDropshipperOnly = customer && customer.role !== "admin" && customer.customerTypes && customer.customerTypes.length === 1 && customer.customerTypes[0] === "Dropshipping";

  React.useEffect(() => {
    if (isDropshipperOnly) {
      router.push("/client");
    }
  }, [isDropshipperOnly, router]);

  React.useEffect(() => {
    shippingService.getConfig()
      .then((config: any) => {
        setShippingConfig(config);
      })
      .catch(console.error);

    if (items && items.length > 0) {
      trackBeginCheckout(items, getCartSubtotal());
    }
  }, []);

  // Load customer on mount
  React.useEffect(() => {
    const loadCustomer = async () => {
      try {
        const customer = await customerService.getActiveCustomer();
        setCurrentUser(customer);
        
        if (customer.role === "admin") {
          const list = await customerService.getCustomers();
          setCustomersList(list);
          
          if (delegatedCustomerId) {
            const selected = list.find((c: any) => c._id === delegatedCustomerId);
            if (selected) {
              setEmail(selected.email || "");
              setFirstName(selected.name?.split(" ")[0] || "");
              setLastName(selected.name?.split(" ").slice(1).join(" ") || "");
              setCompany(selected.company || "");
              setGstin(selected.gstin || "");
              setAddress(selected.address || "");
              setCity(selected.city || "");
              setState(selected.state || INDIAN_STATES[0]);
              setPinCode(selected.pinCode || "");
              setPhone(selected.phone || "");
              setBuyerState(selected.state || INDIAN_STATES[0]);
            }
          } else {
            setState(INDIAN_STATES[0]);
            setBuyerState(INDIAN_STATES[0]);
          }
        } else {
          setEmail(customer.email);
          
          // Fetch saved addresses
          try {
            const addrs = await customerService.getSavedAddresses();
            setSavedAddresses(addrs);
            const defaultAddr = addrs.find((a: any) => a.isDefault);
            if (defaultAddr) {
              setFirstName(defaultAddr.firstName);
              setLastName(defaultAddr.lastName);
              setCompany(defaultAddr.company || "");
              setGstin(defaultAddr.gstin || "");
              setAddress(defaultAddr.address);
              setApartment(defaultAddr.apartment || "");
              setCity(defaultAddr.city);
              setState(defaultAddr.state || INDIAN_STATES[0]);
              setPinCode(defaultAddr.pinCode);
              setPhone(defaultAddr.phone);
              setBuyerState(defaultAddr.state || INDIAN_STATES[0]);
              return;
            }
          } catch (addrErr) {
            console.error("Failed to load saved addresses", addrErr);
          }

          // Fallback to customer model fields
          setFirstName(customer.name.split(" ")[0] || "");
          setLastName(customer.name.split(" ").slice(1).join(" ") || "");
          setCompany(customer.company || "");
          setGstin(customer.gstin || "");
          setAddress(customer.address);
          setCity(customer.city);
          setState(customer.state || INDIAN_STATES[0]);
          setPinCode(customer.pinCode);
          setPhone(customer.phone);
          setBuyerState(customer.state || INDIAN_STATES[0]);
        }
      } catch (err: any) {
        if (err?.status !== 401) {
          console.error("Failed to load active customer:", err.message || err);
        }
        router.push("/login?callbackUrl=/checkout");
      }
    };

    const fetchSettings = async () => {
      try {
        const res = await fetch("/api/cms");
        if (res.ok) {
          const data = await res.json();
          const settings = data.commerceSettings || {};
          const codEnabled = settings.enableCod ?? true;
          const onlineEnabled = settings.enableOnlinePayment ?? true;
          setEnableCod(codEnabled);
          setEnableOnlinePayment(onlineEnabled);
          
          if (onlineEnabled) setPaymentMethod("Razorpay");
          else if (codEnabled) setPaymentMethod("COD");
        }
      } catch (err) {
        console.error("Failed to fetch settings", err);
      }
    };

    fetchSettings();
    loadCustomer();
  }, [setBuyerState, router]);

  /**
   * Loads the Advance Balance balances so the options can show what is actually available.
   * Runs whenever selectedCustomerId changes (for admins) or on mount (for customers).
   */
  React.useEffect(() => {
    const fetchAdvanceBalance = async () => {
      try {
        // If we are an admin and haven't selected a customer yet, we can't fetch their wallet.
        // Wait, if we are admin but no delegated customer is selected, we just don't have a balance to show yet.
        const userIdToFetch = (currentUser?.role === "admin" || currentUser?.role === "manager") ? selectedCustomerId : undefined;
        
        if ((currentUser?.role === "admin" || currentUser?.role === "manager") && !userIdToFetch) {
          setStoreAdvanceBalance(null);
          setBusinessAdvanceBalance(null);
          return;
        }

        const advanceBalances = await advanceBalanceService.getAdvanceBalances(userIdToFetch);
        setStoreAdvanceBalance(advanceBalances.store?.availableBalance ?? null);
        setBusinessAdvanceBalance(advanceBalances.business?.availableBalance ?? null);
      } catch {
        setStoreAdvanceBalance(null);
        setBusinessAdvanceBalance(null);
      }
    };
    
    // Only fetch if we know who the user is
    if (currentUser) {
      fetchAdvanceBalance();
    }
  }, [currentUser, selectedCustomerId]);

  const handleSelectSavedAddress = (id: string) => {
    const selected = savedAddresses.find(a => a._id === id);
    if (selected) {
      setFirstName(selected.firstName || "");
      setLastName(selected.lastName || "");
      setCompany(selected.company || "");
      setGstin(selected.gstin || "");
      setAddress(selected.address || "");
      setApartment(selected.apartment || "");
      setCity(selected.city || "");
      setState(selected.state || INDIAN_STATES[0]);
      setPinCode(selected.pinCode || "");
      setPhone(selected.phone || "");
      setBuyerState(selected.state || INDIAN_STATES[0]);
    }
  };

  const handleApplyCoupon = async () => {
    if (!couponCode) return;
    setIsValidatingCoupon(true);
    try {
      const data = await couponService.validateCoupon(couponCode, grandTotal);
      if (!data.valid) {
        throw new Error(data.message || "Invalid coupon");
      }
      setAppliedCoupon({
        couponCode: data.coupon?.code || couponCode.toUpperCase(),
        discountAmount: data.discountAmount
      });
      setCouponDiscount(data.discountAmount);
      addToast(`Coupon "${data.coupon?.code || couponCode.toUpperCase()}" applied successfully!`, "success");
    } catch (err: unknown) {
      addToast((err as any).message || "Failed to validate coupon", "error");
      setCouponDiscount(0);
      setAppliedCoupon(null);
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponDiscount(0);
    setCouponCode("");
    addToast("Coupon removed", "info");
  };

  const handleSelectDelegatedCustomer = (customerId: string) => {
    setSelectedCustomerId(customerId);
    useCartStore.getState().setDelegatedCustomerId(customerId);
    const selected = customersList.find((c) => c._id === customerId);
    if (selected) {
      setEmail(selected.email || "");
      setFirstName(selected.name?.split(" ")[0] || "");
      setLastName(selected.name?.split(" ").slice(1).join(" ") || "");
      setCompany(selected.company || "");
      setGstin(selected.gstin || "");
      setAddress(selected.address || "");
      setCity(selected.city || "");
      setState(selected.state || INDIAN_STATES[0]);
      setPinCode(selected.pinCode || "");
      setPhone(selected.phone || "");
      setBuyerState(selected.state || INDIAN_STATES[0]);
    } else {
      setEmail("");
      setFirstName("");
      setLastName("");
      setCompany("");
      setGstin("");
      setAddress("");
      setCity("");
      setState(INDIAN_STATES[0]);
      setPinCode("");
      setPhone("");
      setBuyerState(INDIAN_STATES[0]);
    }
  };

  const handleStateChange = (val: string) => {
    setState(val);
    setBuyerState(val);
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();

    if (currentUser?.role === "admin") {
      if (!selectedCustomerId) {
        addToast("Administrators cannot place orders for themselves. Please select a B2B customer from the dropdown list at the top.", "error");
        return;
      }
      if (email.toLowerCase() === currentUser.email.toLowerCase()) {
        addToast("Administrators cannot place orders for themselves. Please select a different B2B customer.", "error");
        return;
      }
    }

    if (!email || !firstName || !lastName || !address || !city || !state || !pinCode || !phone) {
      addToast("Please fill in all required shipping address fields.", "error");
      return;
    }

    const shippingAddress = {
      firstName, lastName, email, company: company || undefined,
      address, apartment: apartment || undefined, city, state, pinCode, phone, gstin: gstin || undefined
    };

    const { calculateShippingByWeight, calculateEffectiveUnitWeightGrams } = require("@/lib/priceTierHelper");
    const { calculateTotalShippingCharge } = require("@/lib/shippingHelper");
    
    const shippingCharge = calculateTotalShippingCharge(items, shippingConfig, calculateShippingByWeight, calculateEffectiveUnitWeightGrams);
    const amountToPay = Math.max(0, grandTotal + shippingCharge - couponDiscount);

    if (paymentMethod === "Razorpay") {
      setIsSubmitting(true);

      // Declared out here so the catch can release the order the try created — a `const`
      // inside the try is not visible to the catch, and that release is the whole point.
      let releaseAbandonedOrder: () => Promise<void> = async () => {};

      try {
        // Order first, then pay.
        //
        // The order (and its stock reservation) has to exist before the buyer reaches
        // Razorpay: it is what binds the payment to a price the server computed, and its id
        // is what both the callback and the webhook use to settle. Paying first left the
        // gateway with no order to point at, so captured payments never marked anything Paid.
        //
        // Because the order holds stock from this moment, an abandoned payment is released
        // immediately below rather than waiting for the daily /api/orders/reap-abandoned
        // sweep, which stays on as the safety net for buyers who close the tab outright.
        const pendingOrderId = await createOrder(
          items,
          amountToPay,
          shippingAddress,
          {
            paymentMethod: "Razorpay",
            paymentStatus: "Pending"
          },
          appliedCoupon?.couponCode || undefined,
          couponDiscount || undefined,
          { shippingCharge }
        );

        if (!pendingOrderId) {
          throw new Error("Could not create your order. Please try again.");
        }

        // Amount comes from the stored order, never from this page.
        const rzpOrderData = await apiClient.post<any>("/razorpay/order", { orderId: pendingOrderId });

        if (!rzpOrderData.orderId) {
          throw new Error(rzpOrderData.error || "Failed to initialize payment gateway");
        }

        // Razorpay fires `handler` on success and `ondismiss` on a manual close, but a slow
        // network can let both run. This flag makes sure a completed payment never triggers
        // the release path below.
        let paymentStarted = false;

        releaseAbandonedOrder = async () => {
          if (paymentStarted) return;
          try {
            await apiClient.post("/orders/cancel-pending", { orderId: pendingOrderId });
          } catch (err) {
            // Non-fatal: the daily reaper will pick the order up. Keep the buyer's cart so
            // they can simply try again.
            console.error("Failed to release abandoned order:", err);
          }
        };

        const options = {
          key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_placeholder",
          amount: String(rzpOrderData.amount),
          currency: rzpOrderData.currency || "INR",
          name: "FlexSell Wholesale",
          description: "Online Wholesale Order Payment",
          order_id: rzpOrderData.orderId,
          handler: async function (response: any) {
            paymentStarted = true;
            try {
              // Settle the order this payment was minted for.
              const verifyData = await apiClient.post<any>("/razorpay/verify", {
                orderId: pendingOrderId,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              });
              if (!verifyData.success) {
                throw new Error(verifyData.error || "Payment verification failed");
              }

              trackPurchase({ _id: pendingOrderId, amount: amountToPay, items });
              clearCart();
              router.push(`/order-confirmation/${pendingOrderId}`);
            } catch (err: unknown) {
              // The money may well have been captured — the webhook is the backstop, so send
              // the buyer to their order rather than implying the payment was lost.
              addToast(
                err instanceof Error
                  ? `${err.message}. If your payment was debited it will be confirmed shortly.`
                  : "Could not confirm payment. If your payment was debited it will be confirmed shortly.",
                "warning"
              );
              clearCart();
              router.push(`/order-confirmation/${pendingOrderId}`);
            }
          },
          modal: {
            ondismiss: async () => {
              // Release the reserved stock straight away and leave the buyer on checkout
              // with their cart intact, so clicking "Place Order" again is a clean retry
              // rather than a second order competing for the same stock.
              setIsSubmitting(false);
              await releaseAbandonedOrder();
              addToast("Payment cancelled. Your cart is saved — you can try again or switch to COD.", "info");
            },
          },
          prefill: {
            name: `${firstName} ${lastName}`,
            email: email,
            contact: phone
          },
          theme: {
            color: "#10b981"
          }
        };

        /**
         * Waits for the SDK, then opens.
         *
         * The `if (!Razorpay)` guard this replaces could never fire: `react-razorpay` hands
         * back a wrapper class that is always truthy, and it is the wrapper's constructor
         * that calls `new window.Razorpay(...)`. Checking it told us nothing; awaiting the
         * real global is what removes the race.
         */
        await openRazorpayCheckout(options as Record<string, unknown>, {
          onPaymentFailed: (response) => {
            // Deliberately does NOT release the order: Razorpay lets the buyer retry with
            // another method inside the same modal, and a released order would leave that
            // retry paying for something already cancelled. `ondismiss` fires when they
            // actually close the window, and that is where the release belongs.
            const failure = response as { error?: { description?: string } };
            setIsSubmitting(false);
            addToast(
              `Payment failed: ${failure.error?.description || "Payment was not completed."} You can try another method.`,
              "error"
            );
          },
        });
      } catch (err: unknown) {
        /**
         * The modal never opened, so `ondismiss` will never fire — and the order was already
         * created above, holding its stock. Release it here, exactly as dismissing the modal
         * would, or a gateway that fails to load quietly strands inventory.
         */
        await releaseAbandonedOrder();

        const isLoadFailure = (err as Error)?.name === "RazorpayUnavailableError";
        addToast(
          isLoadFailure
            ? `${(err as Error).message} Your cart is saved — try again, or choose another payment method.`
            : (err as Error)?.message || "Could not start payment gateway",
          "error"
        );
        setIsSubmitting(false);
      }
      return;
    }

    if (paymentMethod === "Wallet" || paymentMethod === "BusinessAdvanceBalance") {
      setIsSubmitting(true);

      // Minted once per submit attempt so a retried request settles as one payment. The
      // ledger is append-only, so a duplicated debit can only be undone by a reversal the
      // customer would also see.
      const clientRequestId = advanceBalanceService.newRequestId();
      const isAdminOrManager = currentUser?.role === "admin" || currentUser?.role === "manager";
      const targetWalletType = paymentMethod === "BusinessAdvanceBalance" ? "business" : "store";

      try {
        // Order first, then pay — the same ordering the Razorpay path uses. The order is
        // what binds the payment to a server-computed price, and the Advance Balance route reads the
        // amount from it rather than from this page.
        const orderId = await createOrder(
          items,
          amountToPay,
          shippingAddress,
          // Both advanceBalances are the "Wallet" method; which one paid is recorded server-side as
          // `walletType` when the debit succeeds. Encoding it into the method string here
          // (both branches of the ternary this replaces returned "Wallet") lost the
          // distinction entirely and left a failed Business Advance Balance payment un-retryable.
          { paymentMethod: "Wallet", paymentStatus: "Pending" },
          appliedCoupon?.couponCode || undefined,
          couponDiscount || undefined,
          { shippingCharge }
        );

        if (!orderId) throw new Error("Could not create your order. Please try again.");

        if (isAdminOrManager) {
          if (!selectedCustomerId) throw new Error("Please select a customer first.");
          await advanceBalanceService.adminPayOrder({
            orderId,
            customerId: selectedCustomerId,
            walletType: targetWalletType,
            clientRequestId
          });
        } else {
          await advanceBalanceService.payOrderFromAdvanceBalance({ orderId, clientRequestId });
        }

        trackPurchase({ _id: orderId, amount: amountToPay, items });
        clearCart();
        router.push(`/order-confirmation/${orderId}`);
      } catch (err) {
        // The order exists but is unpaid. Releasing it returns the stock immediately rather
        // than waiting for the daily reaper, and nothing has left the Advance Balance — the hold is
        // rolled back server-side on any failure.
        addToast(
          err instanceof Error ? err.message : "Could not pay from your Advance Balance. Please try again.",
          "error"
        );
        setIsSubmitting(false);
      }
      return;
    }

    if (paymentMethod === "COD") {
      setIsSubmitting(true);
      try {
        const orderId = await createOrder(
          items,
          amountToPay,
          shippingAddress,
          {
            paymentMethod: "COD",
            paymentStatus: "Pending"
          },
          appliedCoupon?.couponCode || undefined,
          couponDiscount || undefined,
          { shippingCharge }
        );
        trackPurchase({ _id: orderId, amount: amountToPay, items });
        clearCart();
        router.push(`/order-confirmation/${orderId}`);
      } catch (err) {
        addToast(err instanceof Error ? err.message : "Failed to place order. Please try again.", "error");
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-16 text-center max-w-md">
        <h2 className="text-2xl font-bold mb-2 text-foreground">Checkout is Unavailable</h2>
        <p className="text-muted-foreground mb-6">Your B2B shopping cart is currently empty. Add products to configure bulk pricing.</p>
        <Link href="/products">
          <Button size="lg" className="w-full">Browse Catalog</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-8xl px-4 md:px-6 py-8 text-foreground w-full">
      <h1 className="text-3xl font-bold text-foreground mb-8 text-center">Secure Checkout</h1>

      <form onSubmit={handlePlaceOrder} className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
        <div className="space-y-6">
          <ShippingForm 
            currentUser={currentUser}
            customersList={customersList}
            selectedCustomerId={selectedCustomerId}
            handleSelectDelegatedCustomer={handleSelectDelegatedCustomer}
            savedAddresses={savedAddresses}
            handleSelectSavedAddress={handleSelectSavedAddress}
            email={email} setEmail={setEmail}
            firstName={firstName} setFirstName={setFirstName}
            lastName={lastName} setLastName={setLastName}
            company={company} setCompany={setCompany}
            gstin={gstin} setGstin={setGstin}
            address={address} setAddress={setAddress}
            apartment={apartment} setApartment={setApartment}
            city={city} setCity={setCity}
            state={state} handleStateChange={handleStateChange}
            pinCode={pinCode} setPinCode={setPinCode}
            phone={phone} setPhone={setPhone}
            INDIAN_STATES={INDIAN_STATES}
          />
          <PaymentSection
            paymentMethod={paymentMethod}
            setPaymentMethod={setPaymentMethod}
            enableCod={enableCod}
            enableOnlinePayment={enableOnlinePayment}
            storeAdvanceBalance={storeAdvanceBalance}
            businessAdvanceBalance={businessAdvanceBalance}
            isAdmin={currentUser?.role === "admin" || currentUser?.role === "manager"}
            orderTotal={payableTotal}
          />
        </div>

        <div>
          <Card className="sticky top-20 bg-secondary/20 border-border">
            <OrderSummary
              items={items}
              baseSubtotal={baseSubtotal}
              totalCgst={totalCgst}
              totalSgst={totalSgst}
              totalIgst={totalIgst}
              isIntrastate={isIntrastate}
              couponDiscount={couponDiscount}
              appliedCoupon={appliedCoupon}
              hsnBreakdown={hsnBreakdown}
              grandTotal={grandTotal}
              isSubmitting={isSubmitting}
              shippingConfig={shippingConfig}
            >
              <CouponInput 
                appliedCoupon={appliedCoupon}
                couponDiscount={couponDiscount}
                couponCode={couponCode} setCouponCode={setCouponCode}
                handleApplyCoupon={handleApplyCoupon}
                handleRemoveCoupon={handleRemoveCoupon}
                isValidatingCoupon={isValidatingCoupon}
              />
            </OrderSummary>
          </Card>
        </div>
      </form>

      {/* Suggested Products Carousel based on items in cart */}
      <div className="max-w-5xl mx-auto mt-8">
        <SuggestedProductsCarousel />
      </div>
    </div>
  );
}
