import { isAdvanceBalanceMethod } from "@/lib/advanceBalanceConstants";
import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Order from "@/models/Order";

export const dynamic = "force-dynamic";
export const revalidate = 0;
import Product from "@/models/Product";
import Customer from "@/models/Customer";
import Manager from "@/models/Manager";
import InvoiceModel from "@/models/Invoice";
import CmsContent from "@/models/CmsContent";
import Coupon from "@/models/Coupon";
import { requireAuth } from "@/lib/authGuard";
import { dispatchWebhook } from "@/lib/webhookDispatcher";
import { dispatchEventServer } from "@/lib/events/eventDispatcherServer";
import { generateNextId } from "@/lib/idGeneratorServer";
import { orderSchema } from "@/lib/validators";
import { ZodError } from "zod";
import { resolveVariantKeys } from "@/lib/variantMatcher";
import { isPriceAllowed } from "@/lib/priceTierHelper";
import nodemailer from "nodemailer";
import { ORDER_STATUS_CLASSES } from "@/lib/constants";
import { rateLimit } from "@/lib/rateLimit";
import { runInTransaction } from "@/lib/transactionHelper";
import { revalidateAdminDashboard, revalidateProductStock } from "@/lib/revalidate";
import { actorLabel, buildHistoryEvent } from "@/lib/orderHistory";
import type { HistoryActor } from "@/types";
import { escapeRegex } from "@/lib/utils";
import { formatDateIST, formatDateTimeIST } from "@/lib/datetime";
import {
  computeOrderTaxDetails,
  computeExpectedOrderTotal,
  computeGoodsGrossTotal,
  isOrderTotalAcceptable,
  resolveSellerState,
} from "@/lib/orderTotals";

async function resolveOrderCreatedBy(doc: any) {
  if (!doc) return doc;
  if (doc.createdBy && doc.createdBy.role && doc.createdBy.name) {
    return doc;
  }

  const gen = (doc.generatedBy || "").trim();
  let resolvedCreatedBy: any = null;

  if (gen) {
    const genLower = gen.toLowerCase();
    if (genLower === "system" || genLower === "website-public") {
      resolvedCreatedBy = { role: "System", name: "System" };
    } else {
      // Query Customer model (Admins and Customers)
      const custDoc = await Customer.findOne({
        $or: [
          { _id: gen },
          { email: genLower },
          { name: new RegExp(`^${escapeRegex(gen)}$`, "i") }
        ]
      }).lean() as any;

      if (custDoc) {
        resolvedCreatedBy = {
          role: custDoc.role === "admin" ? "Admin" : "Customer",
          name: custDoc.name,
          email: custDoc.email,
          userId: custDoc._id,
        };
      } else {
        // Query Manager model
        const mgrDoc = await Manager.findOne({
          $or: [
            { _id: gen },
            { email: genLower },
            { name: new RegExp(`^${escapeRegex(gen)}$`, "i") }
          ]
        }).lean() as any;

        if (mgrDoc) {
          resolvedCreatedBy = {
            role: "Manager",
            name: mgrDoc.name,
            email: mgrDoc.email,
            userId: mgrDoc._id,
          };
        }
      }
    }
  }

  return {
    ...doc,
    createdBy: resolvedCreatedBy || doc.createdBy || undefined,
  };
}

/**
 * Allocates the next invoice/receipt number.
 *
 * Delegates to the application-wide generator rather than minting its own series. This used
 * to run a private per-year counter producing `INV-2026-00001` / `RCP-2026-00001`, while
 * `/api/invoices`, `/api/invoices/[id]/settle` and the whole admin UI produced `INV-01001` /
 * `REC-01001` through `generateNextId`. Two parallel series for the same statutory document
 * type is not a numbering scheme, and it made the `INV-` counter meaningless: a customer
 * checkout and a settled receipt could each claim to be "the next" tax invoice.
 *
 * Both were already atomic counters, so nothing about concurrency changes here — only which
 * counter is asked. Documents already carrying `INV-2026-…` / `RCP-2026-…` keep their
 * numbers; the two series simply stop growing.
 */
async function generateInvoiceId(type: "invoice" | "receipt", _session?: any): Promise<string> {
  return generateNextId(type);
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

    if (payload.role !== "admin" && payload.role !== "manager") {
      // B2B buyer can only fetch their own orders matching their customerId (fallback to email)
      andConditions.push({
        $or: [
          { customerId: payload.userId },
          { "shippingAddress.email": payload.email.toLowerCase() }
        ]
      });

      /**
       * Scope to the requested account type, validated against what this customer holds.
       *
       * The dashboard used to do this filtering client-side by guessing from line-item price
       * tiers, which put B2B COD orders in the Dropshipping tab. Enforcing it here means the
       * tab is a real boundary rather than a display convention — and a customer cannot ask
       * for a type they do not hold.
       */
      const requestedType = new URL(request.url).searchParams.get("orderType");
      if (requestedType && requestedType !== "ALL" && requestedType !== "all") {
        const customerDoc = await Customer.findById(payload.userId).select("customerTypes").lean() as
          | { customerTypes?: string[] }
          | null;
        const held = customerDoc?.customerTypes || ["B2C"];

        if (!held.includes(requestedType)) {
          return NextResponse.json(
            { message: "This account does not hold that order type." },
            { status: 403 }
          );
        }

        andConditions.push(
          requestedType === "B2B"
            ? // Legacy orders carry no orderType and are treated as B2B, the same convention
              // the manager branch below already uses.
              { $or: [{ orderType: "B2B" }, { orderType: { $exists: false } }, { orderType: null }] }
            : { orderType: requestedType }
        );
      }
    } else if (payload.role === "manager") {
      // Enforce granular RBAC for managers
      let perms = (payload as any).permissions || [];
      const manager = await Manager.findById(payload.userId).lean();
      if (manager) {
        perms = manager.permissions || [];
      }
      
      const hasPerm = (p: string) => perms.includes(p) || perms.includes(`${p}:read`) || perms.includes(`${p}:update`) || perms.includes(`${p}:create`) || perms.includes(`${p}:delete`);

      const hasB2C = hasPerm("orders_b2c");
      const hasB2B = hasPerm("orders_b2b");
      const hasDrop = hasPerm("orders_dropshipping");

      if (!hasB2C && !hasB2B && !hasDrop) {
        return NextResponse.json({ message: "Forbidden: You don't have access to orders." }, { status: 403 });
      }

      const allowedTypes = [];
      if (hasB2C) allowedTypes.push("B2C");
      if (hasB2B) allowedTypes.push("B2B", null, undefined); // B2B often has null orderType in legacy
      if (hasDrop) allowedTypes.push("Dropshipping");

      if (allowedTypes.length < 3) {
        andConditions.push({
          $or: [
            { orderType: { $in: allowedTypes.filter(Boolean) } },
            ...(allowedTypes.includes(null) ? [{ orderType: { $exists: false } }, { orderType: null }] : [])
          ]
        });
      }
    }

    const { searchParams } = new URL(request.url);
    const page = searchParams.get("page");
    const limit = searchParams.get("limit");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const orderType = searchParams.get("orderType");
    const origin = searchParams.get("origin");
    const createdByFilter = searchParams.get("createdBy");

    /**
     * Status, payment status and search — filtered here rather than in the browser.
     *
     * The order table used to apply these three to whatever array it happened to hold, which
     * was the newest 100 orders. That is only correct while the whole list fits in one
     * response; once it does not, "Delivered" means "Delivered among the last hundred". Doing
     * it in the query is what lets the list be paginated at all.
     */
    const statusFilter = searchParams.get("status");
    const paymentStatusFilter = searchParams.get("paymentStatus");
    const search = searchParams.get("search");

    if (statusFilter) {
      andConditions.push({ status: statusFilter });
    }

    if (paymentStatusFilter) {
      andConditions.push({ paymentStatus: paymentStatusFilter });
    }

    if (search && search.trim()) {
      // Order id or customer name — the two things a staff member has in front of them.
      const term = new RegExp(escapeRegex(search.trim()), "i");
      andConditions.push({ $or: [{ _id: term }, { customerName: term }] });
    }

    if (createdByFilter && createdByFilter !== "all") {
      if (createdByFilter === "me") {
        andConditions.push({ "createdBy.userId": payload.userId });
      } else if (createdByFilter.startsWith("role:")) {
        andConditions.push({ "createdBy.role": createdByFilter.replace("role:", "") });
      } else {
        const regex = new RegExp(escapeRegex(createdByFilter), "i");
        andConditions.push({
          $or: [
            { "createdBy.userId": createdByFilter },
            { "createdBy.role": createdByFilter },
            { "createdBy.name": regex }
          ]
        });
      }
    }

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

    // Staff-only history fields are projected away **in the query** for customers, not
    // filtered in a component. A component that forgets to redact would leak the name of
    // the admin or manager who handled the order; a missing field cannot leak.
    const isStaffViewer = payload.role === "admin" || payload.role === "manager";
    const historyProjection = isStaffViewer ? "" : "-history.internalNote -history.actor";

    if (page && limit) {
      const pageNum = parseInt(page, 10) || 1;
      const limitNum = parseInt(limit, 10) || 20;
      const skip = (pageNum - 1) * limitNum;

      const [rawOrders, total] = await Promise.all([
        Order.find(query).select(historyProjection).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
        Order.countDocuments(query)
      ]);

      const orders = await Promise.all(rawOrders.map((doc) => resolveOrderCreatedBy(doc)));

      return NextResponse.json({
        orders,
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum)
      });
    }

    const rawOrders = await Order.find(query).select(historyProjection).sort({ createdAt: -1 }).limit(100).lean();
    const total = await Order.countDocuments(query);
    const orders = await Promise.all(rawOrders.map((doc) => resolveOrderCreatedBy(doc)));
    
    return NextResponse.json({
      orders,
      total,
      page: 1,
      totalPages: Math.ceil(total / 100)
    });
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

    /**
     * Quotations are standalone price estimates and cannot become orders.
     *
     * This used to be the conversion entry point: given a `quoteId` it copied the quote's
     * lines and total onto the order and **skipped both the per-item price check and the
     * order-total check**, on the grounds that a quoted total is admin-negotiated. That
     * carve-out is the reason this rejection is a hard 400 rather than a quiet ignore — a
     * request carrying a `quoteId` was asking for an unverified price, and silently pricing
     * it another way would be worse than refusing.
     *
     * `Order.quoteId` and its unique index stay in the schema: orders created by the old
     * flow still carry one and must keep resolving.
     */
    if (body.quoteId) {
      return NextResponse.json(
        {
          message:
            "Quotations are standalone price estimates and cannot be converted into orders.",
          code: "QUOTE_CONVERSION_REMOVED",
        },
        { status: 400 }
      );
    }

    // Validate order request with Zod
    const validatedData = orderSchema.parse(body);
    const { items, amount, shippingAddress, paymentDetails, couponCode, couponDiscount, packagingCharge, shippingCharge, salesperson } = validatedData;

    // Validations passed, process checkout

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

      // Fetch customer doc to determine customerTypes for price verification & orderType resolution
      const customerDoc = await Customer.findOne({ email: shippingAddress.email.toLowerCase() }).session(session || null).lean() as any;
      const customerId = customerDoc?._id ? String(customerDoc._id) : "legacy-sync";

      /**
       * Whose entitlement decides which prices are acceptable.
       *
       * This used to read the tier straight off whatever account the **shipping email**
       * belonged to — so anyone who knew a B2B customer's address could type it into the
       * checkout form and be priced as that customer.
       *
       *   - A signed-in **customer** is priced as themselves. The shipping email is a delivery
       *     detail; it says nothing about who is buying.
       *   - **Staff** placing an order on someone's behalf keep the email lookup: that is the
       *     whole point of delegated ordering, and they are already authorised to act for the
       *     customer.
       *   - A **guest** is B2C. There is no wholesale rate to reach without an account.
       */
      const isStaffPlacing = payload.role === "admin" || payload.role === "manager";

      let customerTypes: string[] = ["B2C"];
      if (isStaffPlacing) {
        customerTypes = customerDoc?.customerTypes || ["B2C"];
      } else if (payload.userId) {
        const buyerDoc = (await Customer.findById(payload.userId)
          .session(session || null)
          .select("customerTypes")
          .lean()) as { customerTypes?: string[] } | null;
        customerTypes = buyerDoc?.customerTypes || ["B2C"];
      }

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

          /**
           * Server-side price re-verification.
           *
           * Checks membership of the set of prices this buyer may pay, rather than equality
           * with the single best one. `resolvePrice` returns the best rate they qualify for,
           * and comparing against only that rejected a B2B customer who chose to buy one unit
           * at the retail price — for paying too much.
           *
           * Everything the check needs is computed server-side; nothing from the request is
           * trusted, so a shopper cannot reach a rate they are not entitled to by editing a
           * field.
           */
          /**
           * Unconditional now. This used to be skipped whenever the request carried a
           * `quoteId`, because a quoted line price is admin-negotiated — which meant the one
           * request shape that bypassed price verification entirely was also the one a buyer
           * could aim at someone else's quote. Quotes no longer become orders, so every line
           * on every order is verified.
           */
          const verdict = isPriceAllowed(item.pricePerUnit, sv, customerTypes, item.quantity);
          if (!verdict.ok) {
            throw new Error(
              `Price verification failed for product "${dbProduct.title}". ` +
                `Got ₹${item.pricePerUnit}; this account may pay ${verdict.allowed
                  .map((p) => `₹${p}`)
                  .join(" or ")}.`
            );
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

      const orderDate = formatDateIST(new Date());

      const orderTime = formatDateTimeIST(new Date());

      const customerName = `${shippingAddress.firstName} ${shippingAddress.lastName}${shippingAddress.company ? ` (${shippingAddress.company})` : ""
        }`;

      const sellerInfo = await getSellerInfo();
      const sellerState = resolveSellerState(sellerInfo.address);
      const taxDetails = computeOrderTaxDetails(items, shippingAddress.state, sellerState);

      // Recompute the total from server-verified item prices. Per-item prices are already
      // re-verified above, but without this the client still controls the top-level
      // `amount` — and that is what gets charged and invoiced.
      //
      // No exemption any more. Quote conversions used to be waved through here as
      // admin-negotiated totals; with conversion removed, every order is charged the figure
      // the server computed.
      const expectedTotal = computeExpectedOrderTotal({
        taxDetails,
        shippingCharge: shippingCharge || 0,
        packagingCharge: packagingCharge || 0,
        couponDiscount: couponDiscount || 0,
      });

      if (!isOrderTotalAcceptable(expectedTotal, amount)) {
        throw new Error(
          `Order total mismatch. Expected ₹${expectedTotal.toFixed(2)}, received ₹${Number(amount).toFixed(2)}.`
        );
      }

      // Charge the server's figure, not the client's.
      const chargeableAmount = expectedTotal;

      // Only an admin/manager may declare an order paid at creation time (offline settlement, cash,
      // bank transfer they have confirmed). For everyone else the order starts Pending and
      // is promoted only by `settleOrderPayment`, after a verified gateway signature.
      //
      // The previous rule only forced Pending for `paymentMethod === "Razorpay"` outside a
      // quote, so `{"paymentMethod":"COD","paymentStatus":"Paid"}` — or any payload carrying
      // a quote id — created a fully paid order without a rupee changing hands.
      const isStaff = payload.role === "admin" || payload.role === "manager";

      /**
       * ...and only for a method they can actually attest to.
       *
       * A gateway payment either carries a verified signature or it did not happen, and a
       * Advance Balance is debited by the Advance Balance routes, which read a balance and write a ledger
       * entry. Declaring either one paid here would mark an order settled against money that
       * never moved — the same hole closed in `/api/orders/[id]/status` and
       * `/api/invoices/[id]/settle`. Both fall through to Pending, which is the honest
       * outcome: the gateway or the Advance Balance route then settles it for real.
       */
      const HAND_RECORDABLE =
        !isAdvanceBalanceMethod(paymentDetails?.paymentMethod) &&
        paymentDetails?.paymentMethod !== "Razorpay";
      const pStatus =
        isStaff && HAND_RECORDABLE ? (paymentDetails?.paymentStatus || "Pending") : "Pending";

      // Same reasoning as pStatus: a buyer-supplied transaction id is unverifiable. The real
      // one is stamped by `settleOrderPayment` once the gateway signature checks out.
      const pTransactionId = pStatus === "Paid" ? paymentDetails?.transactionId : undefined;

      const docType = pStatus === "Paid" ? "invoice" : "receipt";
      const invoiceId = await generateInvoiceId(docType, session);

      /**
       * Determine the order's category.
       *
       * Precedence, strongest first:
       *
       *   1. **An explicit choice** — `body.orderType`. Whoever placed the order said what
       *      it was; nothing should second-guess that.
       *   2. The customer's single account type, when they hold exactly one.
       *   3. Only then, a guess from the shipping address.
       *
       * The previous chain started at step 3 for anyone holding more than one type, so a
       * customer who was both B2B and Dropshipping had their order categorised by whether a
       * GSTIN happened to be filled in on the address — and `customerTypes[0]` acted as a
       * tiebreaker elsewhere, which is array ordering standing in for a decision.
       */
      const VALID_ORDER_TYPES = ["B2B", "B2C", "Dropshipping"] as const;
      const isValidOrderType = (v: unknown): v is (typeof VALID_ORDER_TYPES)[number] =>
        typeof v === "string" && (VALID_ORDER_TYPES as readonly string[]).includes(v);

      let orderType: "B2B" | "B2C" | "Dropshipping";

      const explicitType = isValidOrderType(body.orderType) ? body.orderType : null;

      if (explicitType) {
        // A buyer may only claim a type their account actually holds. Staff act on the
        // customer's behalf and are trusted with the choice.
        const staffPlaced = payload.role === "admin" || payload.role === "manager";
        orderType =
          staffPlaced || customerTypes.includes(explicitType) ? explicitType : "B2C";
      } else if (customerTypes.length === 1 && isValidOrderType(customerTypes[0])) {
        orderType = customerTypes[0];
      } else if (shippingAddress?.company || shippingAddress?.gstin || customerTypes.includes("B2B")) {
        orderType = "B2B";
      } else if (customerTypes.includes("Dropshipping")) {
        orderType = "Dropshipping";
      } else {
        orderType = "B2C";
      }

      const origin = isStaff ? "self" : "website";

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
      } else if (payload.role === "customer" || !isStaff) {
        let custName = customerName || `${shippingAddress.firstName} ${shippingAddress.lastName}`;
        if ((!custName || custName === "Customer") && payload.userId) {
          const custDoc = await Customer.findById(payload.userId).lean() as any;
          if (custDoc?.name) custName = custDoc.name;
        }
        if (custName.includes("@")) {
          custName = custName.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
        }
        resolvedCreatedBy = {
          role: "Customer",
          name: custName || "Customer",
          email: shippingAddress.email?.toLowerCase() || payload.email,
          userId: payload.userId,
        };
      }

      // `resolvedCreatedBy` already carries the session-derived { role, name, userId } —
      // reuse it rather than re-deriving, so the order's creator and its first history
      // entry can never disagree about who placed it.
      const placedActor: HistoryActor = {
        role: (resolvedCreatedBy?.role as HistoryActor["role"]) || "System",
        name: resolvedCreatedBy?.name || "System",
        userId: resolvedCreatedBy?.userId,
      };

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
          salesperson,
          invoiceId,
          orderType,
          origin,
          createdBy: resolvedCreatedBy,
          history: [
            buildHistoryEvent({
              status: "Placed",
              actor: placedActor,
              customerNote: "Order placed successfully.",
              internalNote: pStatus === "Paid"
                ? `Order created via ${origin} by ${actorLabel(placedActor)}. Payment recorded (Txn ID: ${pTransactionId || "N/A"}).`
                : `Order created via ${origin} by ${actorLabel(placedActor)}. Payment pending verification.`,
            })
          ]
        });
        await orderInstance.save({ session });
        createdOrder = orderInstance;

        // Create Invoice / Receipt document — reuses the sellerInfo/taxDetails computed
        // above so the invoice can never disagree with the order it documents.
        const generatedAt = formatDateIST(new Date());

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
          generatedBy: isStaff ? payload.userId : "system",
          createdBy: resolvedCreatedBy,
          status: defaultDocStatus,
          salesperson,
          couponCode,
          couponDiscount,
          customerType: orderType,
        });
        await invoiceInstance.save({ session });
        createdDoc = invoiceInstance;

        // 5. Claim the coupon.
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
      const isStaff = payload.role === "admin" || payload.role === "manager";
      const targetCustomerId = isStaff
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
    revalidateProductStock();
    return NextResponse.json(newOrder, { status: 201 });
  } catch (error: any) {
    console.error("Orders API POST error details:", error);
    if (error instanceof ZodError) {
      return NextResponse.json({ message: error.issues[0]?.message || "Validation failed" }, { status: 400 });
    }
    return NextResponse.json({ message: error.message || "Failed to create order" }, { status: 500 });
  }
}

