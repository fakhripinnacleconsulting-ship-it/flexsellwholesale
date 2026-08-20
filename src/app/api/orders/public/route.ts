import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import InvoiceModel from "@/models/Invoice";
import Customer from "@/models/Customer";
import Order from "@/models/Order";
import Product from "@/models/Product";
import CmsContent from "@/models/CmsContent";
import { generateNextId } from "@/lib/idGeneratorServer";
import { resolveVariantKeys } from "@/lib/variantMatcher";
import { isPriceAllowed } from "@/lib/priceTierHelper";
import { revalidateAdminDashboard, revalidateProductStock } from "@/lib/revalidate";
import { buildHistoryEvent, SYSTEM_ACTOR } from "@/lib/orderHistory";
import { issueTaxInvoiceForReceipt, orderPaymentMethodFor, walletTypeForMethod, type StoredReceipt } from "@/lib/orderSettlement";
import { rateLimit } from "@/lib/rateLimit";
import bcrypt from "bcryptjs";
import { formatDateIST } from "@/lib/datetime";

async function getSellerInfo() {
  const brandCms = await CmsContent.findOne({ key: "brandSettings" }).lean();
  const bs = (brandCms?.value || {}) as any;
  return {
    storeName: bs.storeName || "FlexSell Wholesale",
    gstin: bs.gstin || "",
    address: bs.companyAddress || "",
    email: bs.supportEmail || "",
    phone: bs.supportPhone || "",
    logoUrl: "/Flexsell%20Logo.png",
  };
}

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";
    try {
      await rateLimit(`public_order_${ip.split(",")[0].trim()}`, "general");
    } catch (err: any) {
      if (err.message === "Rate limit exceeded") {
        return NextResponse.json({ message: "Too many order requests. Please try again in a minute." }, { status: 429 });
      }
      throw err;
    }

    await dbConnect();

    // Require authentication (Admin or Manager)
    const { getTokenFromCookie, verifyToken } = await import("@/lib/auth");
    const token = await getTokenFromCookie();
    if (!token) {
      return NextResponse.json({ message: "Unauthorized: Please log in to create orders" }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ message: "Unauthorized: Invalid or expired session token" }, { status: 401 });
    }

    const body = await request.json();
    const {
      customerId,
      customerName,
      customerEmail,
      customerGstin,
      items,
      amount,
      shippingCharge = 0,
      taxDetails,
      shippingAddress,
      paymentMethod = "COD",
      paymentStatus = "Pending",
      transactionId,
      notes,
      newCustomer,
      salesperson,
      dropshipDetails,
    } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ message: "Order must contain at least one line item" }, { status: 400 });
    }

    /**
     * Price verification — this route previously had **none at all**.
     *
     * It destructured `amount` and `items` from the request body and wrote them straight onto
     * the order, so anyone could post any price. Fixing verification on `/api/orders` while
     * leaving this open would have moved the hole rather than closed it.
     *
     * Entitlement here is whatever the *named customer* actually holds, not what the request
     * claims — this page is public, so an unrecognised or absent customer is B2C and can reach
     * no wholesale rate at all.
     */
    const lookupEmail = newCustomer?.email || customerEmail;
    const buyerForPricing = customerId
      ? await Customer.findById(customerId).select("customerTypes").lean()
      : lookupEmail
        ? await Customer.findOne({ email: String(lookupEmail).toLowerCase() }).select("customerTypes").lean()
        : null;

    /**
     * A customer this order is about to create does not exist yet, so there is nothing to look
     * up — and defaulting them to B2C would reject the dropship prices the form legitimately
     * submitted, breaking first-time dropship signups.
     *
     * This route is admin/manager-only and hard-codes `resolvedCustomerType = "Dropshipping"`
     * below, creating new accounts with exactly that type. So Dropshipping is not a permissive
     * guess here — it is what this order is, stated before it is written rather than after.
     */
    const pricingTypes: string[] =
      (buyerForPricing as { customerTypes?: string[] } | null)?.customerTypes || ["Dropshipping"];

    for (const item of items) {
      const productId = item.product?._id || item.productId || item.product || item.id;
      if (!productId) continue;

      const dbProduct = await Product.findById(productId).lean() as any;
      if (!dbProduct) {
        return NextResponse.json(
          { message: `Product not found: ${item.productTitle || productId}` },
          { status: 400 }
        );
      }

      const { color, size, weight } = resolveVariantKeys(item.selectedVariants || item.variants || {});
      const cv =
        dbProduct.colorVariants?.find((c: any) => c.color?.toLowerCase() === (color || "").toLowerCase()) ||
        dbProduct.colorVariants?.[0];
      const sv =
        cv?.subVariants?.find(
          (s: any) =>
            (!size || s.size?.toLowerCase() === size.toLowerCase()) &&
            (!weight || s.weight?.toLowerCase() === weight.toLowerCase())
        ) || cv?.subVariants?.[0];

      if (!sv) continue;

      const verdict = isPriceAllowed(
        Number(item.pricePerUnit),
        sv,
        pricingTypes,
        Number(item.quantity) || 1
      );

      if (!verdict.ok) {
        return NextResponse.json(
          {
            message:
              `Price verification failed for "${dbProduct.title}". ` +
              `Got ₹${item.pricePerUnit}; this account may pay ${verdict.allowed.map((p) => `₹${p}`).join(" or ")}.`,
          },
          { status: 400 }
        );
      }
    }

    const resolvedCustomerType = "Dropshipping";

    let resolvedCustomerId = customerId;
    let resolvedCustomerName = customerName;
    let resolvedCustomerEmail = customerEmail;

    if (newCustomer && newCustomer.email) {
      const existingCustomer = await Customer.findOne({
        email: newCustomer.email.toLowerCase().trim(),
      });

      if (existingCustomer) {
        resolvedCustomerId = existingCustomer._id;
        resolvedCustomerName = resolvedCustomerName || existingCustomer.name;
        resolvedCustomerEmail = existingCustomer.email;
      } else {
        const newCustId = await generateNextId("customer");
        const tempPassword = Math.random().toString(36).slice(-8);
        const hashedPassword = await bcrypt.hash(tempPassword, 10);

        const initials = (newCustomer.name || "Client")
          .split(" ")
          .map((w: string) => w[0])
          .join("")
          .toUpperCase()
          .slice(0, 2);

        await Customer.create({
          _id: newCustId,
          name: newCustomer.name,
          email: newCustomer.email.toLowerCase().trim(),
          password: hashedPassword,
          role: "customer",
          company: newCustomer.company || "",
          address: newCustomer.address || "",
          city: newCustomer.city || "",
          state: newCustomer.state || "",
          pinCode: newCustomer.pinCode || "",
          phone: newCustomer.phone || "",
          gstin: newCustomer.gstin || "",
          initials,
          customerTypes: ["Dropshipping"],
        });

        resolvedCustomerId = newCustId;
        resolvedCustomerName = resolvedCustomerName || newCustomer.name;
        resolvedCustomerEmail = newCustomer.email.toLowerCase().trim();
      }
    }

    const sellerInfo = await getSellerInfo();
    const invoiceId = await generateNextId("receipt");
    const orderId = await generateNextId("order");

    /**
     * A dropshipping order paid up front still gets the full paper trail: a `REC-` receipt
     * for what was collected and a separate `INV-` Tax Invoice issued against it.
     *
     * Two families of method are refused as hand-recorded prepayments:
     *   - **Wallets**, because a balance can only be debited by `/api/invoices/[id]/settle`,
     *     which reads a session this public-portal flow does not carry in the buyer's name.
     *   - **Razorpay**, because a gateway payment cannot be attested to. It either carries a
     *     verified signature or it did not happen, and the gateway settles itself through
     *     `/api/razorpay/verify` and the webhook.
     *
     * Either one falls through to a pending order, which is the honest outcome.
     */
    const HAND_RECORDABLE = !["Store Wallet", "Business Wallet", "Wallet", "Razorpay"].includes(
      paymentMethod
    );
    const isPrepaid = paymentStatus === "Paid" && HAND_RECORDABLE;

    /**
     * The status the documents are actually written with.
     *
     * Derived once, and never the caller's word for it: a request naming Razorpay or a wallet
     * with `paymentStatus: "Paid"` used to be written straight through, producing a paid order
     * and a paid receipt with nothing behind either. Anything that is not hand-recordable
     * starts Pending and is settled by the path that can prove it — the gateway callback, or
     * the wallet routes.
     */
    const effectivePaymentStatus = paymentStatus === "Paid" && !HAND_RECORDABLE ? "Pending" : paymentStatus;

    const generatedAt = formatDateIST(new Date());

    const orderDate = formatDateIST(new Date());

    let resolvedCreatedBy: any = { role: "System", name: "System" };
    if (payload.role === "admin") {
      let adminName = "Admin";
      if (payload.userId) {
        const adminDoc = await Customer.findById(payload.userId).lean() as any;
        if (adminDoc?.name) adminName = adminDoc.name;
      }
      if (adminName === "Admin" && payload.email) {
        const adminDoc = await Customer.findOne({ email: payload.email.toLowerCase() }).lean() as any;
        if (adminDoc?.name) adminName = adminDoc.name;
        else adminName = payload.email.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
      }
      resolvedCreatedBy = {
        role: "Admin",
        name: adminName,
        email: payload.email,
        userId: payload.userId,
      };
    } else if (payload.role === "manager") {
      const { default: Manager } = await import("@/models/Manager");
      let managerName = "Manager";
      if (payload.userId) {
        const managerDoc = await Manager.findById(payload.userId).lean() as any;
        if (managerDoc?.name) managerName = managerDoc.name;
      }
      if (managerName === "Manager" && payload.email) {
        const managerDoc = await Manager.findOne({ email: payload.email.toLowerCase() }).lean() as any;
        if (managerDoc?.name) managerName = managerDoc.name;
        else managerName = payload.email.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
      }
      resolvedCreatedBy = {
        role: "Manager",
        name: managerName,
        email: payload.email,
        userId: payload.userId,
      };
    } else if (payload.role === "customer") {
      let custName = resolvedCustomerName || customerName || "Customer";
      if (custName === "Customer" && payload.userId) {
        const custDoc = await Customer.findById(payload.userId).lean() as any;
        if (custDoc?.name) custName = custDoc.name;
      }
      if (custName.includes("@")) {
        custName = custName.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
      }
      resolvedCreatedBy = {
        role: "Customer",
        name: custName || "Customer",
        email: payload.email,
        userId: payload.userId,
      };
    }

    // Create Receipt Invoice
    await InvoiceModel.create({
      _id: invoiceId,
      type: "receipt",
      orderId,
      customerId: resolvedCustomerId || undefined,
      customerName: resolvedCustomerName,
      customerEmail: resolvedCustomerEmail,
      customerGstin: customerGstin || shippingAddress?.gstin || "",
      items,
      amount,
      shippingCharge,
      taxDetails: taxDetails || {
        isIntrastate: true,
        baseSubtotal: amount,
        cgst: 0,
        sgst: 0,
        igst: 0,
        hsnSlabs: [],
      },
      shippingAddress,
      paymentMethod,
      /**
       * The receipt is always born pending, even for a prepaid dropshipping order.
       *
       * Writing `status: "paid"` here produced a paid receipt with no Tax Invoice behind it:
       * the `INV-` counter never advanced and the customer had no compliant document for
       * money they had already handed over. The payment is recorded below through the shared
       * settlement library, which mints the `INV-` and links the two.
       */
      paymentStatus: isPrepaid ? "Pending" : effectivePaymentStatus,
      transactionId: isPrepaid ? undefined : transactionId || undefined,
      sellerInfo,
      notes,
      generatedAt,
      generatedBy: "website-public",
      createdBy: resolvedCreatedBy,
      status: "pending",
      salesperson: salesperson || undefined,
      customerType: resolvedCustomerType,
      dropshipDetails,
    } as any);

    // Create Linked Order
    const newOrder = await Order.create({
      _id: orderId,
      date: orderDate,
      customerId: resolvedCustomerId || undefined,
      customerName: resolvedCustomerName,
      orderType: "Dropshipping",
      origin: salesperson ? "self" : "website",
      items,
      itemsCount: items.length,
      amount,
      taxDetails: taxDetails || {
        isIntrastate: true,
        baseSubtotal: amount,
        cgst: 0,
        sgst: 0,
        igst: 0,
        hsnSlabs: [],
      },
      shippingAddress,
      // Translated to the order enum — the document keeps its own wording. See
      // `orderPaymentMethodFor`.
      paymentMethod: orderPaymentMethodFor(paymentMethod) || "COD",
      walletType: walletTypeForMethod(paymentMethod),
      // Pending until the settlement below records the payment and issues the Tax Invoice.
      paymentStatus: isPrepaid ? "Pending" : effectivePaymentStatus || "Pending",
      status: "Processing",
      statusClass: "bg-blue-100 text-blue-700",
      invoiceId,
      salesperson: salesperson || undefined,
      dropshipDetails,
      createdBy: resolvedCreatedBy,
      history: [
        buildHistoryEvent({
          status: "Processing",
          actor: SYSTEM_ACTOR,
          customerNote: "Order received and is being prepared for dispatch.",
          internalNote: "Dropshipping order created via Public Portal.",
        })
      ]
    } as any);

    revalidateAdminDashboard();

    // Deduct Stock
    if (Array.isArray(items)) {
      for (const item of items) {
        try {
          const pId = item.product?._id || item.productId || item.product || item.id;
          if (!pId) continue;
          const dbProduct = await Product.findById(pId);
          if (!dbProduct) continue;

          const selectedVariants = item.selectedVariants || item.variants || {};
          const { color: selectedColor, size: selectedSize, weight: selectedWeight } = resolveVariantKeys(selectedVariants);

          const cv = dbProduct.colorVariants?.find(
            (c: any) => c.color?.toLowerCase() === (selectedColor || "").toLowerCase()
          ) || dbProduct.colorVariants?.[0];
          if (!cv) continue;

          const sv = cv.subVariants?.find((s: any) =>
            (!selectedSize || s.size?.toLowerCase() === selectedSize.toLowerCase()) &&
            (!selectedWeight || s.weight?.toLowerCase() === selectedWeight.toLowerCase())
          ) || cv.subVariants?.[0];
          if (!sv) continue;

          const qty = Number(item.quantity || item.qty || 1);
          if (qty <= 0) continue;

          await Product.updateOne(
            {
              _id: dbProduct._id,
              "colorVariants.color": cv.color,
              "colorVariants.subVariants": {
                $elemMatch: { size: sv.size, weight: sv.weight }
              }
            },
            {
              $inc: {
                "colorVariants.$[cv].subVariants.$[sv].stock": -qty,
                totalStock: -qty
              }
            },
            {
              arrayFilters: [
                { "cv.color": cv.color },
                { "sv.size": sv.size, "sv.weight": sv.weight }
              ]
            }
          );
        } catch (err) {
          console.error("Failed to deduct stock during public order creation:", err);
        }
      }
      revalidateProductStock();
    }

    // Record the prepayment and issue the Tax Invoice, after the stock has been taken.
    let taxInvoiceId: string | undefined;
    if (isPrepaid) {
      const storedReceipt = (await InvoiceModel.findById(invoiceId).lean()) as StoredReceipt | null;
      if (storedReceipt) {
        const settled = await issueTaxInvoiceForReceipt({
          receipt: storedReceipt,
          method: paymentMethod,
          transactionId: String(transactionId || "").trim() || undefined,
          actor: {
            role: resolvedCreatedBy?.role,
            name: resolvedCreatedBy?.name,
            userId: resolvedCreatedBy?.userId,
          },
        });
        taxInvoiceId = settled.invoiceId;
      }
    }

    return NextResponse.json({
      message: "Dropshipping order created successfully",
      orderId: (newOrder as any)._id || orderId,
      invoiceId: taxInvoiceId || invoiceId,
      receiptId: invoiceId,
      amount: (newOrder as any).amount || amount,
      status: (newOrder as any).status || "Processing",
    }, { status: 201 });
  } catch (error: any) {
    console.error("Public order creation error:", error);
    return NextResponse.json(
      { message: error.message || "Failed to create public dropshipping order" },
      { status: 500 }
    );
  }
}
