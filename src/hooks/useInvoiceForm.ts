import React from "react";
import { Customer, Invoice, Product, TaxBreakdown } from "@/types";
import { INDIAN_STATES } from "@/lib/constants";
import { customerService } from "@/services/customerService";
import { shippingService } from "@/services/shippingService";
import { useInvoiceStore } from "@/stores/invoiceStore";
import { useProductStore } from "@/stores/productStore";
import { useToastStore } from "@/stores/toastStore";
import { useAuthStore } from "@/stores/authStore";
import { invoiceService } from "@/services/invoiceService";
import * as advanceBalanceService from "@/services/advanceBalanceService";
import { collectOrderPaymentOnline } from "@/lib/razorpayCollect";
import { describePaymentFailure } from "@/lib/paymentErrors";
import { ADVANCE_BALANCE_METHODS } from "@/lib/advanceBalanceConstants";
import { apiClient } from "@/lib/apiClient";

interface UseInvoiceFormOptions {
  onSuccess?: (res?: any) => void;
  isPublicMode?: boolean;
  apiEndpoint?: string;
}

/**
 * Methods that can settle a document at the moment it is created.
 *
 * Razorpay is here as a **real gateway run**, not a text field: choosing it opens Razorpay
 * Checkout against the order that was just created, and the payment is only recorded once
 * `/api/razorpay/verify` re-computes the signature. What is not allowed — anywhere — is
 * typing a payment id into a box and calling that a payment.
 *
 * The two balance entries come from the shared constants rather than literals typed here.
 * They were duplicated as `"Store Wallet"` / `"Business Wallet"`, and when the UI copy was
 * renamed the `<option value>` in the modal moved to "Store Advance Balance" while this list
 * did not. Nothing failed loudly: `effectivePaymentMethod` fell back to a string no option
 * carried, so the select rendered its first entry (Cash) and **selecting either balance did
 * nothing at all** — the value bounced straight back on every attempt. One source of truth
 * removes the possibility rather than fixing this instance of it.
 */
export const PAY_NOW_METHODS = [
  "Cash",
  "UPI",
  "Bank Transfer",
  "Razorpay",
  ADVANCE_BALANCE_METHODS.store,
  ADVANCE_BALANCE_METHODS.business,
];

/** Methods that leave the order payable. */
export const PAY_LATER_METHODS = ["COD", "Bank Transfer", "UPI", "Razorpay"];

/** Settled by running the gateway, so it never takes the create-then-settle path. */
export const GATEWAY_METHOD = "Razorpay";

/**
 * Methods that carry a reference worth capturing.
 *
 * Cash is absent on purpose: it reconciles against the cash book, not a UTR, so requiring one
 * just produces unreconcilable strings. Balances are absent because their ledger entry is the
 * reference. Mirrors the same list in `/api/invoices/[id]/settle`, which enforces it.
 */
export const METHODS_REQUIRING_REFERENCE = ["UPI", "Bank Transfer", "NEFT/RTGS", "Cheque"];

export function useInvoiceForm(options?: UseInvoiceFormOptions) {
  const { createInvoice, updateInvoice } = useInvoiceStore();
  const { products, initializeProducts } = useProductStore();
  const { addToast } = useToastStore();
  const { manager, customer } = useAuthStore();

  /**
   * Who to credit the sale to, unless the user says otherwise.
   *
   * The field was a blank text box, so attribution depended on staff remembering to type
   * their own name into it — and manager KPIs are computed from exactly that string.
   */
  const defaultSalesperson = manager?.name || customer?.name || "";

  const [shippingConfig, setShippingConfig] = React.useState<any>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false);
  const [formDocType, setFormDocType] = React.useState<"invoice" | "receipt" | "quote">("invoice");
  const [formCustomerType, setFormCustomerType] = React.useState<"B2B" | "B2C" | "Dropshipping">("B2B");
  const [customers, setCustomers] = React.useState<Customer[]>([]);

  const [customerMode, setCustomerMode] = React.useState<"existing" | "new">("existing");
  const [selectedCustomerId, setSelectedCustomerId] = React.useState("");

  const [newCustName, setNewCustName] = React.useState("");
  const [newCustEmail, setNewCustEmail] = React.useState("");
  const [newCustPhone, setNewCustPhone] = React.useState("");
  const [newCustCompany, setNewCustCompany] = React.useState("");
  const [newCustGstin, setNewCustGstin] = React.useState("");
  const [newCustAddress, setNewCustAddress] = React.useState("");
  const [newCustCity, setNewCustCity] = React.useState("");
  const [newCustState, setNewCustState] = React.useState(INDIAN_STATES[0]);
  const [newCustPinCode, setNewCustPinCode] = React.useState("");

  const [formItems, setFormItems] = React.useState<any[]>([]);
  const [selectedProductId, setSelectedProductId] = React.useState("");
  const [selectedColor, setSelectedColor] = React.useState("");
  const [selectedSize, setSelectedSize] = React.useState("");
  const [selectedWeight, setSelectedWeight] = React.useState("");
  const [itemQty, setItemQty] = React.useState(1);
  const [itemPrice, setItemPrice] = React.useState(0);

  const [paymentMethod, setPaymentMethod] = React.useState("COD");
  const [paymentStatus, setPaymentStatus] = React.useState("Pending");
  /**
   * When the money changes hands — the question the form actually needs answered.
   *
   * It replaces a "Payment Status" dropdown offering Pending / Paid / Failed. That control
   * asked staff to *declare* a payment rather than take one, which is how "Online (Razorpay)
   * + Paid" came to demand a hand-typed transaction reference for money nobody had collected.
   *
   * `now` routes through create-then-settle, the only path that actually moves money.
   * `later` leaves the order and its receipt payable.
   *
   * Defaults to `now`: collecting at the point of sale is the normal case, and the previous
   * default of `later` meant the common path took an extra click while the unusual one — an
   * unpaid order on credit — took none.
   */
  const [paymentTiming, setPaymentTiming] = React.useState<"now" | "later">("now");
  const [transactionId, setTransactionId] = React.useState("");
  const [invoiceNotes, setInvoiceNotes] = React.useState("");
  /**
   * Seeded once from the session so the sale is attributed by default, and freely editable
   * after — including to empty, which an effect-based prefill could not allow.
   *
   * The auth store is persisted and hydrates synchronously, so the name is there on the
   * first render.
   */
  const [salesperson, setSalesperson] = React.useState(defaultSalesperson);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [editInvoiceId, setEditInvoiceId] = React.useState<string | null>(null);
  const [productSearch, setProductSearch] = React.useState("");

  const [isOrderCreationMode, setIsOrderCreationMode] = React.useState(false);
  const [includeDropshipDetails, setIncludeDropshipDetails] = React.useState(true);
  const [dropshipDetails, setDropshipDetails] = React.useState<any>({});

  /**
   * The staff catalogue: active products plus the withdrawn ones.
   *
   * Held here rather than in `useProductStore` so it cannot be served to the storefront -- see
   * the fetch below. Falls back to the shared catalogue until it arrives, so the picker is
   * never empty on first open.
   */
  const [staffProducts, setStaffProducts] = React.useState<Product[] | null>(null);

  const [storeAdvanceBalance, setStoreAdvanceBalance] = React.useState(0);
  const [businessAdvanceBalance, setBusinessAdvanceBalance] = React.useState(0);

  React.useEffect(() => {
    shippingService.getConfig()
      .then((cfg: any) => setShippingConfig(cfg))
      .catch((err: any) => console.error("Failed to load shipping config:", err));
  }, []);

  React.useEffect(() => {
    if (selectedCustomerId && customerMode === "existing") {
      const cust = customers.find(c => c._id === selectedCustomerId);
      if (cust) {
        setNewCustName(cust.name || "");
        setNewCustEmail(cust.email || "");
        setNewCustPhone(cust.phone || "");
        setNewCustCompany(cust.company || "");
        setNewCustGstin(cust.gstin || "");
        const defaultAddr = cust.addresses?.find(a => a.isDefault) || cust.addresses?.[0];
        setNewCustAddress(defaultAddr?.address || cust.address || "");
        setNewCustCity(defaultAddr?.city || cust.city || "");
        setNewCustState(defaultAddr?.state || cust.state || INDIAN_STATES[0]);
        setNewCustPinCode(defaultAddr?.pinCode || cust.pinCode || "");
      }

      // Through the service, not a raw apiClient call — the rule in AGENTS.md, and it is
      // the only place that knows the mock-mode fallback.
      advanceBalanceService
        .getAdvanceBalances(selectedCustomerId)
        .then((res) => {
          setStoreAdvanceBalance(res.store?.availableBalance || 0);
          setBusinessAdvanceBalance(res.business?.availableBalance || 0);
        })
        .catch(() => {
          setStoreAdvanceBalance(0);
          setBusinessAdvanceBalance(0);
        });
    } else {
      setStoreAdvanceBalance(0);
      setBusinessAdvanceBalance(0);
    }
  }, [selectedCustomerId, customerMode, customers]);

  /**
   * Is the money being collected as part of this submit?
   *
   * A Tax Invoice is prepaid by definition — it is only issued once payment is in — so it is
   * always "now" regardless of what the toggle last held. Orders and Sales Receipts choose.
   *
   * Derived rather than synced through an effect: an effect that wrote `paymentTiming` back
   * would let the form render one answer while the submit handler acted on another.
   */
  const isPayNow =
    formDocType !== "quote" &&
    (paymentTiming === "now" || (!isOrderCreationMode && formDocType === "invoice"));

  /**
   * What Pay Now falls back to when the current method belongs to the other mode.
   *
   * The Business Advance Balance for staff — it is how admins and managers settle a customer's order
   * at the counter, so it is the common case and should not need selecting. **Not** in the
   * public dropshipping portal, which hides both advanceBalances: debiting a balance needs a staff
   * session against the document, which that flow does not carry. Defaulting to a hidden
   * option there would bind the select to a value it cannot show and post a method the route
   * refuses, leaving the order silently unpaid.
   */
  const payNowDefaultMethod = options?.isPublicMode ? "Cash" : ADVANCE_BALANCE_METHODS.business;

  /**
   * The method, corrected for the timing.
   *
   * COD cannot be a payment taken now, and a Advance Balance cannot be a promise to pay later. Rather
   * than an effect rewriting `paymentMethod` whenever the timing flips — which briefly leaves
   * the two disagreeing — the invalid combination simply never resolves to itself. The select
   * below is bound to this value, so what the user sees is what gets posted.
   */
  const effectivePaymentMethod = isPayNow
    ? (PAY_NOW_METHODS.includes(paymentMethod) ? paymentMethod : payNowDefaultMethod)
    : (PAY_LATER_METHODS.includes(paymentMethod) ? paymentMethod : "COD");

  React.useEffect(() => {
    const shouldLoad = isCreateModalOpen || options?.isPublicMode;
    if (shouldLoad) {
      initializeProducts();

      /**
       * Staff also get the withdrawn products, fetched separately from the shared catalogue.
       *
       * `useProductStore` caches — `if (!force && products.length > 0) return` — and the
       * storefront reads the same store. Putting "include inactive" on it would let whichever
       * context loaded first decide what the other sees, in either direction: a picker missing
       * withdrawn products, or a storefront store holding them. A separate fetch costs one
       * request on opening the modal and cannot bleed across audiences.
       *
       * Deactivating a product means *withdraw from sale*, not *delete* — a back-order or a
       * price already agreed still needs to be invoiceable. The public portal is excluded: it
       * has no staff session, and `/api/products` refuses the flag without one.
       */
      if (!options?.isPublicMode) {
        apiClient
          .get<Product[]>("/products?includeInactive=true&view=list")
          .then((all) => setStaffProducts(Array.isArray(all) ? all : []))
          .catch((err) => console.error("Failed to load the staff catalogue:", err));
      }

      if (options?.isPublicMode) {
        // Public mode: use unauthenticated customer endpoint
        fetch("/api/customers?public=true&customerType=Dropshipping")
          .then(r => r.ok ? r.json() : [])
          .then((data: any) => setCustomers(Array.isArray(data) ? data : []))
          .catch(err => console.error("Failed to load public customers:", err));
      } else {
        customerService.getCustomers()
          .then(setCustomers)
          .catch(err => console.error("Failed to load customers:", err));
      }
    }
  }, [isCreateModalOpen, initializeProducts, options?.isPublicMode]);

  const handleSaveInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formItems.length === 0) {
      addToast("Please add at least one line item.", "warning");
      return;
    }

    let customerPayload: any = {};
    if (customerMode === "existing") {
      if (!selectedCustomerId) {
        addToast("Please select a registered client.", "warning");
        return;
      }
      const cust = customers.find(c => c._id === selectedCustomerId);
      if (!cust) {
        addToast("Selected client record not found.", "error");
        return;
      }
      customerPayload = {
        customerId: cust._id,
        customerName: cust.name,
        customerEmail: cust.email,
        customerGstin: cust.gstin,
        shippingAddress: {
          firstName: cust.name.split(" ")[0] || "Client",
          lastName: cust.name.split(" ").slice(1).join(" ") || String(formCustomerType),
          email: cust.email,
          company: cust.company,
          address: cust.address || "Warehouse Pickup Address",
          city: cust.city || "Indore",
          state: cust.state || "Madhya Pradesh",
          pinCode: cust.pinCode || "452001",
          phone: cust.phone || "+919876543210",
          gstin: cust.gstin
        }
      };
    } else {
      if (!newCustName || !newCustEmail || !newCustAddress || !newCustCity || !newCustPinCode || !newCustPhone) {
        addToast("Please fill in all required new customer fields.", "warning");
        return;
      }
      customerPayload = {
        newCustomer: {
          name: newCustName,
          email: newCustEmail,
          phone: newCustPhone,
          company: newCustCompany || undefined,
          gstin: newCustGstin || undefined,
          address: newCustAddress,
          city: newCustCity,
          state: newCustState,
          pinCode: newCustPinCode,
          customerTypes: [formCustomerType],
        },
        customerName: newCustName,
        customerEmail: newCustEmail.toLowerCase(),
        customerGstin: newCustGstin || undefined,
        shippingAddress: {
          firstName: newCustName.split(" ")[0] || "Client",
          lastName: newCustName.split(" ").slice(1).join(" ") || String(formCustomerType),
          email: newCustEmail.toLowerCase(),
          company: newCustCompany || undefined,
          address: newCustAddress,
          city: newCustCity,
          state: newCustState,
          pinCode: newCustPinCode,
          phone: newCustPhone,
          gstin: newCustGstin || undefined
        }
      };
    }

    if (formCustomerType === "Dropshipping" && includeDropshipDetails) {
      if (
        !dropshipDetails?.amazonOrderId ||
        !dropshipDetails?.amazonInvoiceId ||
        !dropshipDetails?.amazonInvoiceDate ||
        !dropshipDetails?.customerName ||
        !dropshipDetails?.mobileNumber ||
        !dropshipDetails?.deliveryDate ||
        !dropshipDetails?.city ||
        !dropshipDetails?.state ||
        !dropshipDetails?.pinCode ||
        !dropshipDetails?.address ||
        !dropshipDetails?.amazonTaxInvoice ||
        !dropshipDetails?.amazonPackingSlip
      ) {
        addToast("Please fill in all required Amazon Shipment Details, including document uploads.", "warning");
        return;
      }
    }

    /**
     * A bank-rail payment has to name itself, or it reconciles against nothing.
     *
     * Cash and advanceBalances are exempt: a wallet's ledger entry *is* the reference, and a note
     * handed over the counter has no UTR — demanding one only moves the fabrication from the
     * code to the person typing "CASH-1".
     */
    if (isPayNow && METHODS_REQUIRING_REFERENCE.includes(effectivePaymentMethod) && !transactionId.trim()) {
      addToast(
        `Enter the ${effectivePaymentMethod} reference (UTR or receipt no.) for the payment you received.`,
        "warning"
      );
      return;
    }

    if (formCustomerType === "B2B") {
      for (const item of formItems) {
        const moq = item.b2bMoq || (item as any).product?.b2bMoq || (item as any).moq || 1;
        if (moq > 1 && item.quantity < moq) {
          addToast(
            `Minimum Order Quantity (MOQ) not satisfied for "${item.productTitle || 'item'}". Minimum required: ${moq} pcs.`,
            "warning"
          );
          return;
        }
      }
    }

    setIsSubmitting(true);
    try {
      const isIntrastate = (newCustState || INDIAN_STATES[0]).toLowerCase() === "madhya pradesh";
      let baseSubtotal = 0;
      let totalCgst = 0;
      let totalSgst = 0;
      let totalIgst = 0;
      const slabsMap: Record<string, { base: number; tax: number; rate: number }> = {};

      formItems.forEach(item => {
        const lineGross = item.pricePerUnit * item.quantity;
        const rate = item.gstRate || 18;
        const lineBase = lineGross / (1 + rate / 100);
        const lineTax = lineGross - lineBase;
        baseSubtotal += lineBase;

        if (!slabsMap[item.hsnCode]) {
          slabsMap[item.hsnCode] = { base: 0, tax: 0, rate };
        }
        slabsMap[item.hsnCode].base += lineBase;
        slabsMap[item.hsnCode].tax += lineTax;

        if (isIntrastate) {
          totalCgst += lineTax / 2;
          totalSgst += lineTax / 2;
        } else {
          totalIgst += lineTax;
        }
      });

      const hsnSlabs = Object.entries(slabsMap).map(([hsnCode, d]) => ({
        hsnCode,
        gstRate: d.rate,
        baseAmount: d.base,
        totalTax: d.tax,
        cgst: isIntrastate ? d.tax / 2 : 0,
        sgst: isIntrastate ? d.tax / 2 : 0,
        igst: isIntrastate ? 0 : d.tax,
      }));

      const formTaxBreakdown: TaxBreakdown = {
        isIntrastate,
        baseSubtotal,
        cgst: totalCgst,
        sgst: totalSgst,
        igst: totalIgst,
        hsnSlabs,
      };

      const { calculateTotalShippingCharge } = require("@/lib/shippingHelper");
      const { calculateShippingByWeight, calculateEffectiveUnitWeightGrams } = require("@/lib/priceTierHelper");

      const itemsSubtotal = formItems.reduce((sum, item) => sum + item.pricePerUnit * item.quantity, 0);

      const itemsWithTier = formItems.map(item => ({
        ...item,
        priceTier: formCustomerType
      }));

      const computedShippingCharge = calculateTotalShippingCharge(
        itemsWithTier,
        shippingConfig,
        calculateShippingByWeight,
        calculateEffectiveUnitWeightGrams
      );

      const formGrandTotal = itemsSubtotal + computedShippingCharge;

      /**
       * Everything payable is posted as a **receipt**, then settled if the money is being
       * collected now.
       *
       * `/api/invoices` cannot issue an `INV-` for a Advance Balance payment — it has no way to debit
       * a balance — and issuing one directly would skip the receipt that records what was
       * actually collected. Create-then-settle produces both documents, correctly numbered,
       * through the audited money path.
       */
      const wantsTaxInvoice = !isOrderCreationMode && formDocType === "invoice";
      const effectiveDocType = isOrderCreationMode || wantsTaxInvoice ? "receipt" : formDocType;

      const payloadData = {
        type: effectiveDocType,
        // A Tax Invoice needs an order too — it is a sale, not just paperwork.
        isOrder: isOrderCreationMode || wantsTaxInvoice,
        /**
         * What the user actually asked to create, as opposed to what is posted.
         *
         * Without this the server would see `{ type: "receipt", isOrder: true }` and gate the
         * request on an *orders* permission — so a manager holding `invoices_invoice` would
         * lose the ability to issue a Tax Invoice they could issue before. The intent says
         * which permission governs.
         */
        docIntent: wantsTaxInvoice ? "invoice" : undefined,
        ...customerPayload,
        items: formItems,
        amount: formGrandTotal,
        shippingCharge: computedShippingCharge,
        taxDetails: formTaxBreakdown,
        paymentMethod: effectiveDocType === "quote" ? undefined : effectivePaymentMethod,
        /**
         * Created pending, then settled — except in public mode.
         *
         * `/api/invoices` documents are settled by the call below, which is the only thing
         * that marks them paid, so a document can never claim money no ledger entry backs.
         * The public dropshipping portal posts to `/api/orders/public` instead and cannot
         * call `/settle` (that route needs a staff session against the *document*), so it
         * carries the payment inline and that route issues the Tax Invoice itself.
         */
        paymentStatus: isPayNow && options?.isPublicMode ? "Paid" : "Pending",
        transactionId: isPayNow && options?.isPublicMode ? transactionId.trim() || undefined : undefined,
        notes: invoiceNotes || undefined,
        salesperson: salesperson || undefined,
        customerType: formCustomerType,
        dropshipDetails: (formCustomerType === "Dropshipping" && includeDropshipDetails) ? dropshipDetails : undefined
      };

      if (options?.isPublicMode && options?.apiEndpoint) {
        // Public mode: POST to public endpoint via apiClient
        const res = await apiClient.post<{ orderId?: string }>(options.apiEndpoint, payloadData);

        /**
         * A dropshipping order paid online runs the same gateway as everywhere else.
         *
         * `/api/orders/public` refuses to record Razorpay as already-paid — it cannot verify
         * a signature — so the order lands Pending and the payment is collected here against
         * it. `/api/razorpay/verify` then issues the Tax Invoice.
         */
        if (isPayNow && effectivePaymentMethod === GATEWAY_METHOD && res?.orderId) {
          try {
            const outcome = await collectOrderPaymentOnline({
              orderId: res.orderId,
              customerName: newCustName,
              customerEmail: newCustEmail,
              customerPhone: newCustPhone,
              description: `Payment for order ${res.orderId}`,
            });
            addToast(
              outcome.status === "paid"
                ? `Payment received. Order ${res.orderId} is paid and its Tax Invoice is issued.`
                : `Payment cancelled. Order ${res.orderId} is saved and still payable.`,
              outcome.status === "paid" ? "success" : "info"
            );
          } catch (gatewayErr) {
            addToast(
              describePaymentFailure(gatewayErr, {
                documentNote: `Order ${res.orderId} is saved and still payable.`,
              }),
              "error"
            );
          }
        } else {
          addToast("Dropshipping order created successfully!", "success");
        }

        if (options?.onSuccess) {
          options.onSuccess(res);
        }
        setFormItems([]);
        setSelectedCustomerId("");
        setNewCustName("");
        setNewCustEmail("");
        setNewCustPhone("");
        setNewCustCompany("");
        setNewCustGstin("");
        setNewCustAddress("");
        setNewCustCity("");
        setNewCustPinCode("");
        setPaymentMethod("COD");
        setPaymentStatus("Pending");
        setPaymentTiming("now");
        setTransactionId("");
        setInvoiceNotes("");
        setSalesperson(defaultSalesperson);
        setDropshipDetails({});
        setIncludeDropshipDetails(true);
        setIsSubmitting(false);
        return; // Skip admin-only post-save logic below
      }

      if (editInvoiceId) {
        /**
         * Payment fields are stripped, not sent and ignored.
         *
         * `PUT /api/invoices/[id]` refuses outright — deliberately, so a stale client fails
         * loudly rather than appearing to settle something — any request carrying
         * `paymentStatus`, `paymentMethod` or `transactionId`. This payload always carried
         * `paymentStatus`, so **every** "Edit Quote" save came back 400 "Payment details
         * cannot be set through this endpoint", including edits that touched nothing but the
         * line items. Settlement has its own route; an edit has no business naming a payment.
         */
        const { paymentStatus: _s, paymentMethod: _m, transactionId: _t, isOrder: _o, docIntent: _d, ...editable } =
          payloadData as Record<string, unknown>;
        void _s; void _m; void _t; void _o; void _d;
        await updateInvoice(editInvoiceId, editable as any);
        addToast("Document updated successfully!", "success");
      } else {
        const created = await createInvoice(payloadData as any);

        if (isPayNow && effectivePaymentMethod === GATEWAY_METHOD) {
          /**
           * Run the gateway against the order the document just created.
           *
           * Razorpay never takes the `/settle` route — that route records a payment someone
           * has already collected, and a gateway payment is collected *here*. The signature
           * check in `/api/razorpay/verify` is what settles it, and that path issues the
           * `INV-` through `settleOrderDocuments` exactly as the storefront checkout does.
           */
          const linkedOrderId = (created as any)?.orderId;
          if (!linkedOrderId) {
            addToast(
              `Receipt ${created._id} was created, but it has no linked order to charge. Collect the payment from the Receipts tab.`,
              "warning"
            );
          } else {
            try {
              const outcome = await collectOrderPaymentOnline({
                orderId: linkedOrderId,
                customerName: newCustName,
                customerEmail: newCustEmail,
                customerPhone: newCustPhone,
                description: `Payment for order ${linkedOrderId}`,
              });
              addToast(
                outcome.status === "paid"
                  ? `Payment received. Tax Invoice issued for order ${linkedOrderId}.`
                  : `Payment cancelled. Order ${linkedOrderId} is saved and still payable.`,
                outcome.status === "paid" ? "success" : "info"
              );
            } catch (gatewayErr) {
              addToast(
                describePaymentFailure(gatewayErr, {
                  documentNote: `Order ${linkedOrderId} is saved and can be paid from the Receipts tab.`,
                }),
                "error"
              );
            }
          }
        } else if (isPayNow) {
          /**
           * Take the payment and issue the Tax Invoice.
           *
           * If this fails — most often a Advance Balance short of the total, which comes back as a
           * 409 naming the shortfall — the receipt and its pending order remain and can be
           * settled later from the Receipts tab. Say so, rather than leaving the user
           * thinking nothing was created.
           */
          try {
            const result = await invoiceService.settleInvoice(created._id, {
              method: effectivePaymentMethod,
              transactionId: transactionId.trim() || undefined,
              clientRequestId: advanceBalanceService.newRequestId(),
            });
            addToast(result.message || `Tax Invoice ${result.invoiceId} issued.`, "success");
          } catch (settleErr) {
            addToast(
              describePaymentFailure(settleErr, {
                fallback: "The payment could not be recorded.",
                documentNote: `Receipt ${created._id} was created and is still payable — settle it from the Receipts tab.`,
              }),
              "error"
            );
          }
        } else {
          const docLabel = isOrderCreationMode ? "Order" : (effectiveDocType === "receipt" ? "Receipt" : "Price Quote");
          addToast(
            effectiveDocType === "quote"
              ? "Price Quote generated successfully!"
              : `${docLabel} created — payment pending. Record it from the Receipts tab when it arrives.`,
            "success"
          );
        }
      }
      setIsCreateModalOpen(false);
      setEditInvoiceId(null);
      setProductSearch("");

      setFormItems([]);
      setSelectedCustomerId("");
      setNewCustName("");
      setNewCustEmail("");
      setNewCustPhone("");
      setNewCustCompany("");
      setNewCustGstin("");
      setNewCustAddress("");
      setNewCustCity("");
      setNewCustPinCode("");
      setPaymentMethod("COD");
      setPaymentStatus("Pending");
      setPaymentTiming("now");
      setTransactionId("");
      setInvoiceNotes("");
      setSalesperson(defaultSalesperson);
      setDropshipDetails({});
      setIncludeDropshipDetails(true);

      if (options?.onSuccess) {
        options.onSuccess();
      }
    } catch (err) {
      /**
       * Through the same describer as the payment failures, mainly so a Mongoose message
       * cannot reach the user. A model error that escapes a route reads as
       * "Order validation failed: paymentMethod: `Business Advance Balance` is not a valid enum
       * value" — accurate, and meaningless to a salesperson.
       */
      addToast(
        describePaymentFailure(err, { fallback: "The document could not be saved. Please try again." }),
        "error"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditQuote = (inv: Invoice) => {
    setEditInvoiceId(inv._id);
    setFormDocType(inv.type);
    setFormCustomerType((inv as any).customerType || "B2B");

    if (inv.customerId) {
      setCustomerMode("existing");
      setSelectedCustomerId(inv.customerId);
    } else {
      setCustomerMode("new");
      setNewCustName(inv.customerName);
      setNewCustEmail(inv.customerEmail);
      setNewCustPhone(inv.shippingAddress?.phone || "");
      setNewCustCompany(inv.shippingAddress?.company || "");
      setNewCustGstin(inv.customerGstin || "");
      setNewCustAddress(inv.shippingAddress?.address || "");
      setNewCustCity(inv.shippingAddress?.city || "");
      setNewCustState(inv.shippingAddress?.state || INDIAN_STATES[0]);
      setNewCustPinCode(inv.shippingAddress?.pinCode || "");
    }

    setFormItems(inv.items || []);
    setPaymentMethod(inv.paymentMethod || "Bank Transfer");
    setPaymentStatus(inv.paymentStatus || "Pending");
    setTransactionId(inv.transactionId || "");
    setSalesperson(inv.salesperson || "");
    setInvoiceNotes((inv as any).notes || "");

    setIsCreateModalOpen(true);
  };

  return {
    isCreateModalOpen,
    setIsCreateModalOpen,
    formDocType,
    setFormDocType,
    formCustomerType,
    setFormCustomerType,
    customerMode,
    setCustomerMode,
    selectedCustomerId,
    setSelectedCustomerId,
    newCustName,
    setNewCustName,
    newCustEmail,
    setNewCustEmail,
    newCustPhone,
    setNewCustPhone,
    newCustCompany,
    setNewCustCompany,
    newCustGstin,
    setNewCustGstin,
    newCustAddress,
    setNewCustAddress,
    newCustCity,
    setNewCustCity,
    newCustState,
    setNewCustState,
    newCustPinCode,
    setNewCustPinCode,
    formItems,
    setFormItems,
    selectedProductId,
    setSelectedProductId,
    selectedColor,
    setSelectedColor,
    selectedSize,
    setSelectedSize,
    selectedWeight,
    setSelectedWeight,
    itemQty,
    setItemQty,
    itemPrice,
    setItemPrice,
    paymentMethod,
    setPaymentMethod,
    paymentStatus,
    setPaymentStatus,
    paymentTiming,
    setPaymentTiming,
    // Derived, and what the form must render — see the notes on each above.
    isPayNow,
    effectivePaymentMethod,
    transactionId,
    setTransactionId,
    salesperson,
    setSalesperson,
    invoiceNotes,
    setInvoiceNotes,
    isSubmitting,
    setIsSubmitting,
    editInvoiceId,
    setEditInvoiceId,
    productSearch,
    setProductSearch,
    isOrderCreationMode,
    setIsOrderCreationMode,
    includeDropshipDetails,
    setIncludeDropshipDetails,
    dropshipDetails,
    setDropshipDetails,
    storeAdvanceBalance,
    businessAdvanceBalance,
    customers,
    // Withdrawn products included for staff; the shared catalogue until that arrives.
    products: staffProducts ?? products,
    shippingConfig,
    handleSaveInvoice,
    handleEditQuote,
    addToast
  };
}
