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
import { INDIAN_STATES } from "@/lib/constants";
import { ShippingForm } from "./checkout/ShippingForm";
import { PaymentSection } from "./checkout/PaymentSection";
import { OrderSummary } from "./checkout/OrderSummary";
import { CouponInput } from "./checkout/CouponInput";
import { Card } from "@/components/ui/Card";
import { useRazorpay } from "react-razorpay";
import { SuggestedProductsCarousel } from "./SuggestedProductsCarousel";

export function CheckoutView() {
  const router = useRouter();
  const { addToast } = useToastStore();
  const { items, buyerState, setBuyerState, clearCart, getTaxDetails, hydrateProducts } = useCartStore();
  const { createOrder } = useOrderStore();
  const [shippingConfig, setShippingConfig] = React.useState<any>(null);

  React.useEffect(() => {
    const initCartProducts = async () => {
      const productState = useProductStore.getState();
      if (productState.products.length === 0) {
        await productState.initializeProducts();
      }
      hydrateProducts();
    };
    initCartProducts();
  }, [hydrateProducts]);

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

  const [paymentMethod, setPaymentMethod] = React.useState<"Razorpay" | "COD">("Razorpay");
  const [enableCod, setEnableCod] = React.useState(true);
  const [enableOnlinePayment, setEnableOnlinePayment] = React.useState(true);
  const [isPaying, setIsPaying] = React.useState(false);
  const { Razorpay } = useRazorpay();

  // Coupon states
  const [couponCode, setCouponCode] = React.useState("");
  const [appliedCoupon, setAppliedCoupon] = React.useState<any>(null);
  const [couponDiscount, setCouponDiscount] = React.useState(0);
  const [isValidatingCoupon, setIsValidatingCoupon] = React.useState(false);

  // Admin delegation states
  const [currentUser, setCurrentUser] = React.useState<any>(null);
  const [customersList, setCustomersList] = React.useState<any[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = React.useState("");
  const [savedAddresses, setSavedAddresses] = React.useState<any[]>([]);

  // Dropshipping redirect guard
  const customer = useAuthStore((state: any) => state.customer);
  const isDropshipperOnly = customer && customer.customerTypes && customer.customerTypes.length === 1 && customer.customerTypes[0] === "Dropshipping";

  React.useEffect(() => {
    if (isDropshipperOnly) {
      window.location.href = "/client";
    }
  }, [isDropshipperOnly]);

  React.useEffect(() => {
    shippingService.getConfig()
      .then((config: any) => {
        setShippingConfig(config);
      })
      .catch(console.error);
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
          setState(INDIAN_STATES[0]);
          setBuyerState(INDIAN_STATES[0]);
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
      } catch (err) {
        console.error("Failed to load active customer:", err);
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
        alert("Administrators cannot place orders for themselves. Please select a B2B customer from the dropdown list at the top.");
        return;
      }
      if (email.toLowerCase() === currentUser.email.toLowerCase()) {
        alert("Administrators cannot place orders for themselves. Please select a different B2B customer.");
        return;
      }
    }

    if (!email || !firstName || !lastName || !address || !city || !state || !pinCode || !phone) {
      alert("Please fill in all required shipping address fields.");
      return;
    }

    const shippingAddress = {
      firstName, lastName, email, company: company || undefined,
      address, apartment: apartment || undefined, city, state, pinCode, phone, gstin: gstin || undefined
    };

    // Parse weight string to grams
    const parseWeightToGrams = (weightStr: string): number => {
      if (!weightStr) return 0;
      const clean = weightStr.toLowerCase().trim();
      const num = parseFloat(clean.replace(/[^0-9.]/g, ""));
      if (isNaN(num)) return 0;
      if (clean.includes("kg")) {
        return num * 1000;
      }
      return num;
    };

    const b2cWeightGrams = items
      .filter(item => item.priceTier !== "B2B")
      .reduce((sum, item) => {
        const matchingColor = item.selectedVariants["Color"] || item.selectedVariants["color"];
        const activeVariant = item.product.colorVariants?.find(cv => cv.color === matchingColor)
          || item.product.colorVariants?.[0];
        const activeSubVariant = activeVariant?.subVariants?.find(sv =>
          (!item.selectedVariants["Size"] || sv.size === item.selectedVariants["Size"]) &&
          (!item.selectedVariants["Weight"] || sv.weight === item.selectedVariants["Weight"])
        ) || activeVariant?.subVariants?.[0];
        const unitWeightStr = activeSubVariant?.weight || "0g";
        return sum + (parseWeightToGrams(unitWeightStr) * item.quantity);
      }, 0);

    const hasB2B = items.some(item => item.priceTier === "B2B");
    const hasB2C = items.some(item => item.priceTier !== "B2B");

    const b2bFixed = shippingConfig?.b2bFixedCharge ?? 150;
    const slabs = shippingConfig?.weightSlabs || [];

    const b2bShipping = hasB2B ? b2bFixed : 0;
    const { calculateShippingByWeight } = require("@/lib/priceTierHelper");
    const b2cShipping = hasB2C ? calculateShippingByWeight(b2cWeightGrams, slabs) : 0;

    const shippingCharge = b2bShipping + b2cShipping;
    const amountToPay = Math.max(0, grandTotal + shippingCharge - couponDiscount);

    if (paymentMethod === "Razorpay") {
      setIsSubmitting(true);
      
      try {
        const rzpOrderRes = await fetch("/api/razorpay/order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: amountToPay }),
        });
        const rzpOrderData = await rzpOrderRes.json();
        
        if (!rzpOrderRes.ok || !rzpOrderData.orderId) {
          throw new Error(rzpOrderData.error || "Failed to initialize payment gateway");
        }

        const options = {
          key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_placeholder",
          amount: Math.round(amountToPay * 100).toString(),
          currency: "INR",
          name: "FlexSell Wholesale",
          description: "B2B Order Payment",
          order_id: rzpOrderData.orderId,
          handler: async function (response: any) {
            try {
              const orderId = await createOrder(
                items,
                amountToPay,
                shippingAddress,
                {
                  paymentMethod: "Razorpay",
                  paymentStatus: "Paid",
                  transactionId: response.razorpay_payment_id
                },
                appliedCoupon?.couponCode || undefined,
                couponDiscount || undefined
              );
              clearCart();
              router.push(`/order-confirmation/${orderId}`);
            } catch (err: unknown) {
              alert(err instanceof Error ? (err as any).message : "Failed to save order. Please contact support.");
              setIsSubmitting(false);
            }
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

        const rzp = new (Razorpay as any)(options as any);
        rzp.on("payment.failed", function (response: any) {
          alert("Payment failed: " + response.error.description);
          setIsSubmitting(false);
        });
        rzp.open();
      } catch (err: any) {
        alert(err.message);
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
          couponDiscount || undefined
        );
        clearCart();
        router.push(`/order-confirmation/${orderId}`);
      } catch (err) {
        alert(err instanceof Error ? (err as any).message : "Failed to place order. Please try again.");
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
            paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod}
            enableCod={enableCod} enableOnlinePayment={enableOnlinePayment}
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
