import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Order from "@/models/Order";

export const dynamic = "force-dynamic";
export const revalidate = 0;
import Product from "@/models/Product";
import Customer from "@/models/Customer";
import InvoiceModel from "@/models/Invoice";
import CmsContent from "@/models/CmsContent";
import Coupon from "@/models/Coupon";
import { requireAuth } from "@/lib/authGuard";
import { dispatchWebhook } from "@/lib/webhookDispatcher";
import { dispatchEventServer } from "@/lib/events/eventDispatcherServer";
import { generateNextId, nextCounterValue } from "@/lib/idGeneratorServer";
import { orderSchema } from "@/lib/validators";
import { ZodError } from "zod";
import { resolveVariantKeys } from "@/lib/variantMatcher";
import { resolvePrice } from "@/lib/priceTierHelper";
import nodemailer from "nodemailer";
import { ORDER_STATUS_CLASSES } from "@/lib/constants";
import { rateLimit } from "@/lib/rateLimit";
import { runInTransaction } from "@/lib/transactionHelper";
import { revalidateAdminDashboard, revalidateProducts } from "@/lib/revalidate";
import {
  computeOrderTaxDetails,
  computeExpectedOrderTotal,
  computeGoodsGrossTotal,
  isOrderTotalAcceptable,
  resolveSellerState,
} from "@/lib/orderTotals";

/**
 * Allocates the next invoice/receipt number for the current year.
 *
 * Backed by an atomic counter rather than "read the highest existing id and add one" —
 * two checkouts landing together both read the same highest id, both derived the same
 * number, and the second lost its invoice to a duplicate-key error mid-transaction.
 *
 * The counter is seeded from the existing documents the first time a given
 * prefix/year is used, so numbering continues rather than restarting at 1.
 */
async function generateInvoiceId(type: "invoice" | "receipt", _session?: any): Promise<string> {
  const prefix = type === "invoice" ? "INV" : "RCP";
  const year = new Date().getFullYear();

  const seq = await nextCounterValue(`counter_doc_${prefix}_${year}`, async () => {
    const lastDoc = await InvoiceModel.findOne({ _id: new RegExp(`^${prefix}-${year}-`) })
      .sort({ _id: -1 })
      .select("_id")
      .lean() as any;
    if (!lastDoc) return 0;
    const lastSeq = parseInt((lastDoc._id as string).split("-")[2], 10);
    return isNaN(lastSeq) ? 0 : lastSeq;
  });

  return `${prefix}-${year}-${String(seq).padStart(5, "0")}`;
}

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

export async function GET(request: Request) {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;
    const payload = auth.payload!;

    await dbConnect();
    const andConditions: any[] = [];

    if (payload.role !== "admin") {
      // B2B buyer can only fetch their own orders matching their customerId (fallback to email)
      andConditions.push({
        $or: [
          { customerId: payload.userId },
          { "shippingAddress.email": payload.email.toLowerCase() }
        ]
      });
    }

    const { searchParams } = new URL(request.url);
    const page = searchParams.get("page");
    const limit = searchParams.get("limit");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const orderType = searchParams.get("orderType");
    const origin = searchParams.get("origin");

    if (orderType && orderType !== "ALL" && orderType !== "all") {
      if (orderType === "B2B") {
        andConditions.push({ 
          $or: [
            { orderType: "B2B" }, 
            { orderType: { $exists: false } },
            { orderType: null }
          ] 
        });
      } else if (orderType === "Dropshipping") {
        andConditions.push({ orderType: "Dropshipping" });
      } else if (orderType === "B2C") {
        andConditions.push({ orderType: "B2C" });
      }
    }

    if (origin) {
      if (origin === "self") {
        andConditions.push({
          $or: [
            { origin: "self" },
            { 
              origin: { $exists: false }, 
              $or: [
                { quoteId: { $exists: true, $nin: [null, ""] } },
                { salesperson: { $exists: true, $nin: [null, ""] } }
              ]
            }
          ]
        });
      } else {
        andConditions.push({
          $or: [
            { origin: "website" },
            {
              origin: { $exists: false },
              $and: [
                { $or: [{ quoteId: { $exists: false } }, { quoteId: null }, { quoteId: "" }] },
                { $or: [{ salesperson: { $exists: false } }, { salesperson: null }, { salesperson: "" }] }
              ]
            }
          ]
        });
      }
    }

    if (startDate || endDate) {
      const dateQuery: any = {};
      if (startDate) {
        dateQuery.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateQuery.$lte = end;
      }
      andConditions.push({ createdAt: dateQuery });
    }

    const query = andConditions.length > 0 ? { $and: andConditions } : {};

    if (page && limit) {
      const pageNum = parseInt(page, 10) || 1;
      const limitNum = parseInt(limit, 10) || 20;
      const skip = (pageNum - 1) * limitNum;

      const [orders, total] = await Promise.all([
        Order.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
        Order.countDocuments(query)
      ]);

      return NextResponse.json({
        orders,
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum)
      });
    }

    const orders = await Order.find(query).sort({ createdAt: -1 }).limit(100).lean();
    return NextResponse.json(orders);
  } catch (error: unknown) {
    return NextResponse.json({ message: (error as any).message || "Failed to fetch orders" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    // Rate limit order creation to prevent abuse
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    try {
      await rateLimit(ip);
    } catch {
      return NextResponse.json({ message: "Too many requests. Please try again later." }, { status: 429 });
    }

    const auth = await requireAuth();
    if (auth.error) return auth.error;
    const payload = auth.payload!;

    await dbConnect();
    const body = await request.json();
    
    // If quoteId is provided, populate items, amount, and shippingAddress from the quote to
    // satisfy Zod and build the order.
    if (body.quoteId) {
      const quote = await InvoiceModel.findById(body.quoteId).lean() as any;
      if (!quote) {
        return NextResponse.json({ message: "Quote not found" }, { status: 404 });
      }
      if (quote.status === "converted") {
        return NextResponse.json({ message: "This quote has already been converted to an order." }, { status: 400 });
      }

      // A quote conversion skips the per-item price check and the order-total check further
      // down, because those totals are admin-negotiated. That carve-out is only safe if the
      // caller actually owns the quote — otherwise any buyer could name someone else's quote
      // id and buy at an arbitrary price.
      if (payload.role !== "admin") {
        const quoteEmail = (quote.customerEmail || "").toLowerCase();
        if (!quoteEmail || quoteEmail !== payload.email.toLowerCase()) {
          return NextResponse.json({ message: "This quote does not belong to your account." }, { status: 403 });
        }
      }

      const normalizedItems = (quote.items || []).map((i: any, idx: number) => {
        const pId = typeof i.product === "object" ? (i.product?._id || i.productId || `PROD-${idx}`) : (i.productId || (typeof i.product === "string" ? i.product : `PROD-${idx}`));
        const pTitle = typeof i.product === "object" ? (i.product?.title || i.product?.name || "Wholesale Product") : (i.productTitle || i.name || i.title || "Wholesale Product");
        return {
          id: i.id || i._id || `item-${idx}-${Date.now()}`,
          productId: pId,
          product: {
            _id: pId,
            title: pTitle,
            categoryId: i.product?.categoryId || i.categoryId || "cat-default",
            gstRate: i.product?.gstRate || i.gstRate || 18,
            priceIncludesGst: i.product?.priceIncludesGst ?? true,
          },
          selectedVariants: i.selectedVariants || i.variants || {},
          quantity: Number(i.quantity || 1),
          pricePerUnit: Number(i.pricePerUnit || i.price || 0)
        };
      });

      // Always take lines and total from the stored quote, never from the request. The
      // price/total verification below is deliberately skipped for quote conversions, so
      // letting the client override these would hand it a blank cheque.
      body.items = normalizedItems;
      body.amount = Number(quote.amount || 0);

      const isInputAddrValid = body.shippingAddress && body.shippingAddress.address && body.shippingAddress.email;
      body.shippingAddress = isInputAddrValid ? body.shippingAddress : (quote.shippingAddress || {
        firstName: quote.customerName ? quote.customerName.split(" ")[0] : "Valued",
        lastName: quote.customerName ? quote.customerName.split(" ").slice(1).join(" ") || "Buyer" : "Buyer",
        email: quote.customerEmail || "customer@example.com",
        company: quote.customerCompany || "",
        address: "Wholesale Dock Facility Address",
        city: "Mumbai",
        state: "Maharashtra",
        pinCode: "400001",
        phone: "9876543210",
        gstin: quote.customerGstin || ""
      });

      body.couponCode = body.couponCode || quote.couponCode;
      body.couponDiscount = body.couponDiscount || quote.couponDiscount;
      body.salesperson = body.salesperson || quote.salesperson;
    }

    // Validate order request with Zod
    const validatedData = orderSchema.parse(body);
    const { items, amount, shippingAddress, paymentDetails, couponCode, couponDiscount, packagingCharge, shippingCharge, quoteId, salesperson } = validatedData;

    // Validations passed, process checkout

    // Idempotency Check: if quoteId is provided, check if Order already exists
    if (quoteId) {
      const existingOrder = await Order.findOne({ quoteId }).lean();
      if (existingOrder) {
        return NextResponse.json(existingOrder, { status: 200 });
      }

      // Check if quote has already been converted
      const quote = await InvoiceModel.findById(quoteId).lean() as any;
      if (!quote) {
        return NextResponse.json({ message: "Quote not found" }, { status: 404 });
      }
      if (quote.status === "converted") {
        return NextResponse.json({ message: "This quote has already been converted to an order." }, { status: 400 });
      }
    }

    // Re-verify coupon validity and discount on backend for security
    let dbCoupon = null;
    if (couponCode) {
      const cleanCode = couponCode.toUpperCase().trim();
      dbCoupon = await Coupon.findOne({ code: cleanCode });
      if (!dbCoupon) {
        return NextResponse.json({ message: `Coupon "${cleanCode}" is invalid.` }, { status: 400 });
      }
      if (!dbCoupon.isActive) {
        return NextResponse.json({ message: "This coupon is no longer active" }, { status: 400 });
      }
      const todayStr = new Date().toISOString().split("T")[0];
      if (dbCoupon.expiryDate < todayStr) {
        return NextResponse.json({ message: "This coupon has expired" }, { status: 400 });
      }
      if (dbCoupon.usageLimit !== null && dbCoupon.usageLimit !== undefined) {
        if ((dbCoupon.usedCount || 0) >= dbCoupon.usageLimit) {
          return NextResponse.json({ message: "This coupon has reached its overall usage limit" }, { status: 400 });
        }
      }
      const userEmail = payload.email?.toLowerCase() || "";
      if (dbCoupon.isPersonalized) {
        const isAllowed = dbCoupon.allowedCustomers?.some((email: string) => email.toLowerCase() === userEmail);
        if (!isAllowed) {
          return NextResponse.json({ message: "This coupon is not valid for your account" }, { status: 400 });
        }
      }
      const customerUses = dbCoupon.usedBy?.filter((email: string) => email.toLowerCase() === userEmail).length || 0;
      const customerLimit = dbCoupon.usageLimitPerCustomer || 1;
      if (customerUses >= customerLimit) {
        return NextResponse.json({ message: "You have already reached the maximum usage limit for this coupon" }, { status: 400 });
      }

      // Same GST-inclusive basis the checkout used when it called /api/coupons/validate.
      const orderSubtotal = computeGoodsGrossTotal(items);
      if (dbCoupon.minOrderValue && dbCoupon.minOrderValue > 0 && orderSubtotal < dbCoupon.minOrderValue) {
        return NextResponse.json({ message: `Minimum order value of ₹${dbCoupon.minOrderValue} required for coupon "${cleanCode}".` }, { status: 400 });
      }

      let calculatedDiscount = 0;
      if (dbCoupon.discountType === "flat") {
        calculatedDiscount = dbCoupon.discountValue;
      } else {
        calculatedDiscount = orderSubtotal * (dbCoupon.discountValue / 100);
        if (dbCoupon.maxDiscount && calculatedDiscount > dbCoupon.maxDiscount) {
          calculatedDiscount = dbCoupon.maxDiscount;
        }
      }
      if (calculatedDiscount > orderSubtotal) {
        calculatedDiscount = orderSubtotal;
      }

      const roundedDiscount = parseFloat(calculatedDiscount.toFixed(2));
      if (couponDiscount !== undefined && Math.abs(roundedDiscount - couponDiscount) > 0.05) {
        return NextResponse.json({ message: `Coupon discount calculation mismatch. Expected: ${roundedDiscount}, Got: ${couponDiscount}` }, { status: 400 });
      }
    }

    const orderId = await generateNextId("order");

    let couponClaimed = false;

    const newOrder = await runInTransaction(async (session) => {
      // runInTransaction re-invokes this callback without a session when it detects a
      // standalone (non-replica-set) MongoDB, so per-attempt state has to be reset here
      // rather than carried over from the aborted attempt.
      couponClaimed = false;

      // Re-verify idempotency check inside transaction
      if (quoteId) {
        const existingOrder = await Order.findOne({ quoteId }).session(session || null).lean();
        if (existingOrder) {
          return existingOrder;
        }
      }

      // Fetch customer doc to determine customerTypes for price verification & orderType resolution
      const customerDoc = await Customer.findOne({ email: shippingAddress.email.toLowerCase() }).session(session || null).lean() as any;
      const customerId = customerDoc?._id ? String(customerDoc._id) : "legacy-sync";
      const customerTypes: string[] = customerDoc?.customerTypes || ["B2C"];

      // Deduct stock for each ordered item atomically
      // size/weight are stored exactly as the deduction used them (including undefined for
      // variants that have no such dimension), so the compensating update targets the same
      // sub-variant. Normalising them to "" and back to undefined desynchronised the two.
      const stockRollbacks: Array<{ productId: string; cvColor: string; size?: string; weight?: string; qty: number }> = [];
      try {
        for (const item of items) {
          const dbProduct = await Product.findById(item.product._id).session(session || null);
          if (!dbProduct) {
            throw new Error(`Product not found: ${item.product.title}`);
          }

          const { color: selectedColor, size: selectedSize, weight: selectedWeight } = resolveVariantKeys(item.selectedVariants);

          const cv = dbProduct.colorVariants?.find(
            (c: any) => c.color?.toLowerCase() === selectedColor.toLowerCase()
          );
          if (!cv) {
            throw new Error(`Color variant "${selectedColor}" not found for product "${dbProduct.title}"`);
          }

          const sv = cv.subVariants?.find((s: any) => 
            (!selectedSize || s.size?.toLowerCase() === selectedSize.toLowerCase()) && 
            (!selectedWeight || s.weight?.toLowerCase() === selectedWeight.toLowerCase())
          );
          if (!sv) {
            throw new Error(`Variant size/weight option not found for product "${dbProduct.title}"`);
          }

          if (sv.stock < item.quantity) {
            throw new Error(`Insufficient stock for product "${dbProduct.title}" (${selectedColor} - ${selectedSize || ""})`);
          }

          // Server-side Price Re-verification (Security Check)
          if (!quoteId) {
            const expectedPrice = resolvePrice(sv, customerTypes, item.quantity);
            if (expectedPrice > 0 && Math.abs(expectedPrice - item.pricePerUnit) > 0.05) {
              throw new Error(`Price verification failed for product "${dbProduct.title}". Expected ₹${expectedPrice}, got ₹${item.pricePerUnit}.`);
            }
          }

          const updateResult = await Product.updateOne(
            {
              _id: item.product._id,
              "colorVariants.color": cv.color,
              "colorVariants.subVariants": {
                $elemMatch: {
                  size: sv.size,
                  weight: sv.weight,
                  stock: { $gte: item.quantity }
                }
              }
            },
            {
              $inc: {
                "colorVariants.$[cv].subVariants.$[sv].stock": -item.quantity,
                totalStock: -item.quantity
              }
            },
            {
              arrayFilters: [
                { "cv.color": cv.color },
                { "sv.size": sv.size, "sv.weight": sv.weight }
              ],
              session
            }
          );

          if (updateResult.modifiedCount === 0) {
            throw new Error(`Concurrency error: Stock update failed for "${dbProduct.title}"`);
          }

          stockRollbacks.push({
            productId: item.product._id,
            cvColor: cv.color,
            size: sv.size,
            weight: sv.weight,
            qty: item.quantity
          });
        }
      } catch (err: any) {
        // Safe manual rollback if session is standalone MongoDB fallback
        if (!session) {
          for (const rb of stockRollbacks) {
            await Product.updateOne(
              {
                _id: rb.productId,
                "colorVariants.color": rb.cvColor,
                "colorVariants.subVariants": {
                  $elemMatch: {
                    size: rb.size,
                    weight: rb.weight
                  }
                }
              },
              {
                $inc: {
                  "colorVariants.$[cv].subVariants.$[sv].stock": rb.qty,
                  totalStock: rb.qty
                }
              },
              {
                arrayFilters: [
                  { "cv.color": rb.cvColor },
                  { "sv.size": rb.size, "sv.weight": rb.weight }
                ]
              }
            );
          }
        }
        throw err;
      }

      const orderDate = new Date().toLocaleDateString("en-US", {
        month: "short", day: "2-digit", year: "numeric"
      });

      const orderTime = new Date().toLocaleString("en-US", {
        month: "short", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
      });

      const customerName = `${shippingAddress.firstName} ${shippingAddress.lastName}${
        shippingAddress.company ? ` (${shippingAddress.company})` : ""
      }`;

      const sellerInfo = await getSellerInfo();
      const sellerState = resolveSellerState(sellerInfo.address);
      const taxDetails = computeOrderTaxDetails(items, shippingAddress.state, sellerState);

      // Recompute the total from server-verified item prices. Per-item prices are already
      // re-verified above, but without this the client still controls the top-level
      // `amount` — and that is what gets charged and invoiced.
      // Quote conversions are exempt: those totals are admin-negotiated, same carve-out
      // the per-item price check uses.
      const expectedTotal = computeExpectedOrderTotal({
        taxDetails,
        shippingCharge: shippingCharge || 0,
        packagingCharge: packagingCharge || 0,
        couponDiscount: couponDiscount || 0,
      });

      if (!quoteId && !isOrderTotalAcceptable(expectedTotal, amount)) {
        throw new Error(
          `Order total mismatch. Expected ₹${expectedTotal.toFixed(2)}, received ₹${Number(amount).toFixed(2)}.`
        );
      }

      // Charge the server's figure, not the client's.
      const chargeableAmount = quoteId ? amount : expectedTotal;

      // Only an admin may declare an order paid at creation time (offline settlement, cash,
      // bank transfer they have confirmed). For everyone else the order starts Pending and
      // is promoted only by `settleOrderPayment`, after a verified gateway signature.
      //
      // The previous rule only forced Pending for `paymentMethod === "Razorpay"` outside a
      // quote, so `{"paymentMethod":"COD","paymentStatus":"Paid"}` — or any payload carrying
      // a quoteId — created a fully paid order without a rupee changing hands.
      const pStatus = payload.role === "admin"
        ? (paymentDetails?.paymentStatus || "Pending")
        : "Pending";

      // Same reasoning as pStatus: a buyer-supplied transaction id is unverifiable. The real
      // one is stamped by `settleOrderPayment` once the gateway signature checks out.
      const pTransactionId = payload.role === "admin" ? paymentDetails?.transactionId : undefined;

      const docType = pStatus === "Paid" ? "invoice" : "receipt";
      const invoiceId = await generateInvoiceId(docType, session);

      // Determine B2B/B2C/Dropshipping category and order origin
      let orderType: "B2B" | "B2C" | "Dropshipping" = "B2C";
      if (quoteId) {
        const quoteDoc = await InvoiceModel.findById(quoteId).session(session || null).lean() as unknown as { customerType?: "B2B" | "B2C" | "Dropshipping" } | null;
        if (quoteDoc && quoteDoc.customerType) {
          orderType = quoteDoc.customerType;
        } else if (customerTypes.length === 1 && customerTypes[0] === "Dropshipping") {
          orderType = "Dropshipping";
        } else if (shippingAddress?.company || shippingAddress?.gstin || customerTypes.includes("B2B")) {
          orderType = "B2B";
        } else {
          orderType = "B2C";
        }
      } else if (customerTypes.length === 1 && customerTypes[0] === "Dropshipping") {
        orderType = "Dropshipping";
      } else if (shippingAddress?.company || shippingAddress?.gstin || customerTypes.includes("B2B")) {
        orderType = "B2B";
      } else if (customerTypes.includes("Dropshipping")) {
        orderType = "Dropshipping";
      } else {
        orderType = "B2C";
      }

      const isSelf = payload.role === "admin" || !!quoteId;
      const origin = isSelf ? "self" : "website";

      let createdOrder: any = null;
      let createdDoc: any = null;

      try {
        const orderInstance = new Order({
          _id: orderId,
          date: orderDate,
          customerId,
          amount: chargeableAmount,
          status: "Processing",
          statusClass: ORDER_STATUS_CLASSES["Processing"],
          itemsCount: items.reduce((sum: number, item: any) => sum + item.quantity, 0),
          customerName,
          shippingAddress: shippingAddress as any,
          items: items as any,
          paymentMethod: paymentDetails?.paymentMethod,
          paymentStatus: pStatus,
          transactionId: pTransactionId,
          couponCode,
          couponDiscount,
          packagingCharge: packagingCharge || 0,
          shippingCharge: shippingCharge || 0,
          quoteId,
          salesperson,
          invoiceId,
          orderType,
          origin,
          history: [
            {
              status: "Placed",
              timestamp: orderTime,
              description: pStatus === "Paid"
                ? `Wholesale order generated successfully. Payment recorded by admin (Txn ID: ${pTransactionId || "N/A"}).`
                : "Wholesale order generated successfully. Payment pending verification."
            }
          ]
        });
        await orderInstance.save({ session });
        createdOrder = orderInstance;

        // Create Invoice / Receipt document — reuses the sellerInfo/taxDetails computed
        // above so the invoice can never disagree with the order it documents.
        const generatedAt = new Date().toLocaleDateString("en-IN", {
          day: "2-digit", month: "long", year: "numeric",
        });

        let defaultDocStatus = "paid";
        if (docType === "receipt") {
          defaultDocStatus = pStatus === "Failed" ? "failed" : "pending";
        }

        const invoiceInstance = new InvoiceModel({
          _id: invoiceId,
          type: docType,
          orderId,
          customerId,
          customerName,
          customerEmail: shippingAddress.email.toLowerCase(),
          customerGstin: shippingAddress.gstin || "",
          items,
          amount: chargeableAmount,
          taxDetails,
          shippingAddress,
          paymentMethod: paymentDetails?.paymentMethod,
          paymentStatus: pStatus,
          transactionId: pTransactionId,
          sellerInfo,
          generatedAt,
          generatedBy: payload.role === "admin" ? payload.userId : "system",
          status: defaultDocStatus,
          salesperson,
          couponCode,
          couponDiscount,
          customerType: orderType,
        });
        await invoiceInstance.save({ session });
        createdDoc = invoiceInstance;

        // 5. Convert Quote status to converted
        if (quoteId) {
          await InvoiceModel.updateOne(
            { _id: quoteId } as any,
            { $set: { status: "converted", orderId } },
            { session }
          );
        }

        // 6. Claim the coupon.
        //
        // The eligibility checks ran before the transaction; re-assert the limits here as
        // update conditions so the claim is atomic. Previously the increment happened after
        // the transaction with no conditions at all, so concurrent checkouts all passed the
        // earlier read and a single-use coupon could be redeemed any number of times.
        if (dbCoupon) {
          const buyerEmail = payload.email.toLowerCase();
          const limitGuard =
            dbCoupon.usageLimit !== null && dbCoupon.usageLimit !== undefined
              ? { $expr: { $lt: [{ $ifNull: ["$usedCount", 0] }, dbCoupon.usageLimit] } }
              : {};

          const claimed = await Coupon.findOneAndUpdate(
            { _id: dbCoupon._id, isActive: true, ...limitGuard } as Record<string, unknown>,
            { $inc: { usedCount: 1 }, $push: { usedBy: buyerEmail } },
            { new: true, session: session || null }
          );

          if (!claimed) {
            throw new Error("This coupon has reached its usage limit.");
          }

          // Per-customer limit, re-checked against the post-claim document.
          const usesByBuyer = (claimed.usedBy || []).filter(
            (e: string) => e.toLowerCase() === buyerEmail
          ).length;
          if (usesByBuyer > (dbCoupon.usageLimitPerCustomer || 1)) {
            throw new Error("You have already reached the maximum usage limit for this coupon.");
          }

          couponClaimed = true;
        }

        return JSON.parse(JSON.stringify(createdOrder));
      } catch (err: any) {
        // Rollback created docs manually if standalone database fallback
        if (!session) {
          if (couponClaimed && dbCoupon) {
            // Release exactly one redemption. `$pull` would drop every entry for this buyer,
            // erasing their earlier legitimate uses of the same coupon, so splice out only
            // the first match.
            const buyerEmail = payload.email.toLowerCase();
            await Coupon.updateOne({ _id: dbCoupon._id } as Record<string, unknown>, [
              {
                $set: {
                  usedCount: { $max: [0, { $subtract: [{ $ifNull: ["$usedCount", 1] }, 1] }] },
                  usedBy: {
                    $let: {
                      vars: { i: { $indexOfArray: [{ $ifNull: ["$usedBy", []] }, buyerEmail] } },
                      in: {
                        $cond: [
                          { $gte: ["$$i", 0] },
                          {
                            $concatArrays: [
                              { $slice: ["$usedBy", 0, "$$i"] },
                              { $slice: ["$usedBy", { $add: ["$$i", 1] }, { $size: "$usedBy" }] },
                            ],
                          },
                          { $ifNull: ["$usedBy", []] },
                        ],
                      },
                    },
                  },
                },
              },
            ] as Record<string, unknown>[]);
          }
          if (createdDoc) {
            await InvoiceModel.deleteOne({ _id: invoiceId } as any);
          }
          if (createdOrder) {
            await Order.deleteOne({ _id: orderId } as any);
          }
          // Restore stock
          for (const rb of stockRollbacks) {
            await Product.updateOne(
              {
                _id: rb.productId,
                "colorVariants.color": rb.cvColor,
                "colorVariants.subVariants": {
                  $elemMatch: {
                    size: rb.size,
                    weight: rb.weight
                  }
                }
              } as any,
              {
                $inc: {
                  "colorVariants.$[cv].subVariants.$[sv].stock": rb.qty,
                  totalStock: rb.qty
                }
              },
              {
                arrayFilters: [
                  { "cv.color": rb.cvColor },
                  { "sv.size": rb.size, "sv.weight": rb.weight }
                ]
              }
            );
          }
        }
        throw err;
      }
    });

    // Dispatch Centralized System Event (Triggers In-App Notifications, Web Push Banners, and Transactional Emails)
    // Only dispatch ORDER_CREATED notification if order is already paid (e.g. admin/online instant)
    // or if paymentMethod is NOT Razorpay (e.g. COD / Bank Transfer).
    // Online Razorpay orders will dispatch notification upon payment verification in /api/razorpay/verify or webhook.
    if (newOrder?.paymentStatus === "Paid" || paymentDetails?.paymentMethod !== "Razorpay") {
      const targetCustomerId = payload.role === "admin"
        ? (await Customer.findOne({ email: shippingAddress.email.toLowerCase() }).select("_id"))?._id || payload.userId
        : payload.userId;

      dispatchEventServer({
        eventType: "ORDER_CREATED",
        category: "orders",
        actor: { id: payload.userId, name: payload.email, role: (payload.role as "admin" | "customer" | "system") || "customer" },
        recipient: { customerId: targetCustomerId, email: shippingAddress.email, name: `${shippingAddress.firstName} ${shippingAddress.lastName}`, role: "both" },
        entity: { type: "order", id: orderId },
        data: newOrder,
      });
    }

    revalidateAdminDashboard();
    revalidateProducts();
    return NextResponse.json(newOrder, { status: 201 });
  } catch (error: any) {
    console.error("Orders API POST error details:", error);
    if (error instanceof ZodError) {
      return NextResponse.json({ message: error.issues[0]?.message || "Validation failed" }, { status: 400 });
    }
    return NextResponse.json({ message: error.message || "Failed to create order" }, { status: 500 });
  }
}

