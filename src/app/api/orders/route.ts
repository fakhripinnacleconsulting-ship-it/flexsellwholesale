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
import { dispatchEvent } from "@/lib/events/eventDispatcher";
import { generateNextId } from "@/lib/idGeneratorServer";
import { orderSchema } from "@/lib/validators";
import { ZodError } from "zod";
import { resolveVariantKeys } from "@/lib/variantMatcher";
import { resolvePrice } from "@/lib/priceTierHelper";
import nodemailer from "nodemailer";
import { ORDER_STATUS_CLASSES } from "@/lib/constants";
import { rateLimit } from "@/lib/rateLimit";
import { runInTransaction } from "@/lib/transactionHelper";
import { revalidateAdminDashboard, revalidateProducts } from "@/lib/revalidate";

async function generateInvoiceId(type: "invoice" | "receipt", session?: any): Promise<string> {
  const prefix = type === "invoice" ? "INV" : "RCP";
  const year = new Date().getFullYear();
  const regex = new RegExp(`^${prefix}-${year}-`);
  const lastDoc = await InvoiceModel.findOne({ _id: regex })
    .sort({ _id: -1 })
    .select("_id")
    .session(session || null)
    .lean() as any;
  let nextSeq = 1;
  if (lastDoc) {
    const parts = (lastDoc._id as string).split("-");
    const lastSeq = parseInt(parts[2], 10);
    if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
  }
  return `${prefix}-${year}-${String(nextSeq).padStart(5, "0")}`;
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

function computeOrderTaxDetails(items: any[], buyerState: string, sellerState: string) {
  const isIntrastate = buyerState.toLowerCase() === sellerState.toLowerCase();
  const hsnMap: Record<string, any> = {};
  let baseSubtotal = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let totalIgst = 0;

  items.forEach((item: any) => {
    const rate = item.product?.gstRate ?? 18;
    const hsn = item.product?.hsnCode ?? "3924";
    const isIncl = item.product?.priceIncludesGst ?? true;
    const totalAmount = item.pricePerUnit * item.quantity;
    let itemBase = 0;
    let itemTax = 0;

    if (isIncl) {
      itemBase = totalAmount / (1 + rate / 100);
      itemTax = totalAmount - itemBase;
    } else {
      itemBase = totalAmount;
      itemTax = itemBase * (rate / 100);
    }

    baseSubtotal += itemBase;
    let cgst = 0, sgst = 0, igst = 0;
    if (isIntrastate) {
      cgst = itemTax / 2;
      sgst = itemTax / 2;
      totalCgst += cgst;
      totalSgst += sgst;
    } else {
      igst = itemTax;
      totalIgst += igst;
    }

    if (!hsnMap[hsn]) {
      hsnMap[hsn] = { hsnCode: hsn, gstRate: rate, baseAmount: 0, totalTax: 0, cgst: 0, sgst: 0, igst: 0 };
    }
    hsnMap[hsn].baseAmount += itemBase;
    hsnMap[hsn].totalTax += itemTax;
    hsnMap[hsn].cgst += cgst;
    hsnMap[hsn].sgst += sgst;
    hsnMap[hsn].igst += igst;
  });

  return {
    isIntrastate,
    baseSubtotal,
    cgst: totalCgst,
    sgst: totalSgst,
    igst: totalIgst,
    hsnSlabs: Object.values(hsnMap),
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
      // B2B buyer can only fetch their own orders matching their email
      andConditions.push({ "shippingAddress.email": payload.email.toLowerCase() });
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
    
    // If quoteId is provided, pre-populate missing items, amount, and shippingAddress from the quote to satisfy Zod and build the order
    if (body.quoteId) {
      const quote = await InvoiceModel.findById(body.quoteId).lean() as any;
      if (!quote) {
        return NextResponse.json({ message: "Quote not found" }, { status: 404 });
      }
      if (quote.status === "converted") {
        return NextResponse.json({ message: "This quote has already been converted to an order." }, { status: 400 });
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

      body.items = (body.items && Array.isArray(body.items) && body.items.length > 0) ? body.items : normalizedItems;
      body.amount = (body.amount && Number(body.amount) > 0) ? Number(body.amount) : Number(quote.amount || 0);
      
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

      const orderSubtotal = items.reduce((sum: number, item: any) => sum + (item.pricePerUnit * item.quantity), 0);
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

    const newOrder = await runInTransaction(async (session) => {
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
      const stockRollbacks: Array<{ productId: string; cvColor: string; size: string; weight: string; qty: number }> = [];
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
            size: sv.size || "",
            weight: sv.weight || "",
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
                    size: rb.size || undefined,
                    weight: rb.weight || undefined
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
                  { "sv.size": rb.size || undefined, "sv.weight": rb.weight || undefined }
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

      let pStatus = paymentDetails?.paymentStatus || "Pending";
      // Security: Force non-admin online Razorpay payments to start as Pending until verified via /api/razorpay/verify
      if (paymentDetails?.paymentMethod === "Razorpay" && payload.role !== "admin" && !quoteId) {
        pStatus = "Pending";
      }

      const docType = pStatus === "Paid" ? "invoice" : "receipt";
      const invoiceId = await generateInvoiceId(docType, session);

      // Determine B2B/B2C/Dropshipping category and order origin
      let orderType: "B2B" | "B2C" | "Dropshipping" = "B2C";
      if (customerTypes.length === 1 && customerTypes[0] === "Dropshipping") {
        orderType = "Dropshipping";
      } else if (!!quoteId || !!salesperson || !!shippingAddress?.company || !!shippingAddress?.gstin || customerTypes.includes("B2B")) {
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
          amount,
          status: "Processing",
          statusClass: ORDER_STATUS_CLASSES["Processing"],
          itemsCount: items.reduce((sum: number, item: any) => sum + item.quantity, 0),
          customerName,
          shippingAddress: shippingAddress as any,
          items: items as any,
          paymentMethod: paymentDetails?.paymentMethod,
          paymentStatus: pStatus,
          transactionId: paymentDetails?.transactionId,
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
                ? `Wholesale order generated successfully. Online Payment verified (Txn ID: ${paymentDetails?.transactionId}).`
                : "Wholesale order generated successfully. Payment pending verification."
            }
          ]
        });
        await orderInstance.save({ session });
        createdOrder = orderInstance;

        // Create Invoice / Receipt document
        const sellerInfo = await getSellerInfo();
        const sellerState = sellerInfo.address.match(/(?:,\s*)([A-Za-z\s]+?)(?:\s*-\s*\d|$)/)?.[1]?.trim() || "Madhya Pradesh";
        const taxDetails = computeOrderTaxDetails(items, shippingAddress.state, sellerState);
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
          amount,
          taxDetails,
          shippingAddress,
          paymentMethod: paymentDetails?.paymentMethod,
          paymentStatus: pStatus,
          transactionId: paymentDetails?.transactionId,
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

        return JSON.parse(JSON.stringify(createdOrder));
      } catch (err: any) {
        // Rollback created docs manually if standalone database fallback
        if (!session) {
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
                    size: rb.size || undefined,
                    weight: rb.weight || undefined
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
                  { "sv.size": rb.size || undefined, "sv.weight": rb.weight || undefined }
                ]
              }
            );
          }
        }
        throw err;
      }
    });

    if (dbCoupon) {
      await Coupon.updateOne(
        { _id: dbCoupon._id },
        { 
          $inc: { usedCount: 1 },
          $push: { usedBy: payload.email.toLowerCase() }
        }
      );
    }

    // Dispatch Centralized System Event (Triggers In-App Notifications, Web Push Banners, and Transactional Emails)
    const targetCustomerId = payload.role === "admin"
      ? (await Customer.findOne({ email: shippingAddress.email.toLowerCase() }).select("_id"))?._id || payload.userId
      : payload.userId;

    dispatchEvent({
      eventType: "ORDER_CREATED",
      category: "orders",
      actor: { id: payload.userId, name: payload.email, role: (payload.role as "admin" | "customer" | "system") || "customer" },
      recipient: { customerId: targetCustomerId, email: shippingAddress.email, name: `${shippingAddress.firstName} ${shippingAddress.lastName}`, role: "both" },
      entity: { type: "order", id: orderId },
      data: newOrder,
    });

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
