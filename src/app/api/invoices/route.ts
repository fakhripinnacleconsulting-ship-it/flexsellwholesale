import { isAdvanceBalanceMethod } from "@/lib/advanceBalanceConstants";
import { formatDateIST } from "@/lib/datetime";
import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import InvoiceModel from "@/models/Invoice";
import Customer from "@/models/Customer";
import Order from "@/models/Order";
import Product from "@/models/Product";
import CmsContent from "@/models/CmsContent";
import Manager from "@/models/Manager";
import { requireAuth } from "@/lib/authGuard";
import { actorLabel, buildHistoryEvent } from "@/lib/orderHistory";
import type { HistoryActor } from "@/types";
import { generateNextId } from "@/lib/idGeneratorServer";
import { computeOrderTaxDetails, resolveSellerState } from "@/lib/orderTotals";
import { issueTaxInvoiceForReceipt, orderPaymentMethodFor, walletTypeForMethod, type StoredReceipt } from "@/lib/orderSettlement";
import { resolveVariantKeys } from "@/lib/variantMatcher";
import { revalidateProductStock } from "@/lib/revalidate";
import { escapeRegex } from "@/lib/utils";
import bcrypt from "bcryptjs";

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

async function resolveDocCreatedBy(doc: any) {
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
        // Query Manager model safely (only include _id in $or if gen is a valid 24-char ObjectId)
        const isObjectId = /^[0-9a-fA-F]{24}$/.test(gen);
        const mgrOr: any[] = [
          { email: genLower },
          { name: new RegExp(`^${escapeRegex(gen)}$`, "i") }
        ];
        if (isObjectId) {
          mgrOr.push({ _id: gen });
        }

        const mgrDoc = await Manager.findOne({ $or: mgrOr }).lean() as any;

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

async function generateInvoiceId(type: "invoice" | "receipt" | "quote"): Promise<string> {
  return generateNextId(type);
}

export async function GET(request: Request) {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;
    const payload = auth.payload!;

    await dbConnect();
    // No backfill runs on read. The 70-line syncMissingInvoicesForOrders() that used to sit
    // above was already dead code — its call site was removed to stop it recreating deleted
    // receipts. A backfill belongs in scripts/, not on the hot path of every list request.

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const status = searchParams.get("status");
    const customerId = searchParams.get("customerId");
    const orderId = searchParams.get("orderId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const search = searchParams.get("search");
    const page = searchParams.get("page");
    const limit = searchParams.get("limit");
    const showArchived = searchParams.get("showArchived") === "true";
    const customerType = searchParams.get("customerType");
    const createdByFilter = searchParams.get("createdBy");

    const query: any = {};

    if (createdByFilter && createdByFilter !== "all") {
      if (createdByFilter === "me") {
        query["createdBy.userId"] = payload.userId;
      } else if (createdByFilter.startsWith("role:")) {
        query["createdBy.role"] = createdByFilter.replace("role:", "");
      } else {
        const regex = new RegExp(escapeRegex(createdByFilter), "i");
        query.$or = [
          { "createdBy.userId": createdByFilter },
          { "createdBy.role": createdByFilter },
          { "createdBy.name": regex },
          { generatedBy: regex }
        ];
      }
    }
    
    if (payload.role === "manager") {
      let perms = (payload as any).permissions || [];
      if (payload.userId && /^[0-9a-fA-F]{24}$/.test(payload.userId)) {
        const managerUser = await Manager.findById(payload.userId).lean();
        if (managerUser) {
          perms = managerUser.permissions || [];
        }
      }
      
      const hasPerm = (p: string) =>
        perms.includes(p) || perms.some((perm: string) => perm.startsWith(`${p}:`));

      const hasInvoices = hasPerm("invoices_invoice");
      const hasQuotes = hasPerm("invoices_quote");
      const hasReceipts = hasPerm("invoices_receipt");
      
      if (!hasInvoices && !hasQuotes && !hasReceipts) {
        return NextResponse.json({ message: "Forbidden: No document access" }, { status: 403 });
      }
      
      const allowedDocTypes = [];
      if (hasInvoices) allowedDocTypes.push("invoice");
      if (hasQuotes) allowedDocTypes.push("quote");
      if (hasReceipts) allowedDocTypes.push("receipt");

      if (type) {
        if (!allowedDocTypes.includes(type)) {
          return NextResponse.json({ message: "Forbidden document type" }, { status: 403 });
        }
        query.type = type;
      } else {
        query.type = { $in: allowedDocTypes };
      }
    } else {
      if (type) query.type = type;
    }

    if (status) {
      query.status = status;
    } else if (!showArchived) {
      if (type === "quote") {
        query.status = { $nin: ["archived", "converted"] };
      } else {
        query.status = { $ne: "archived" };
      }
    }
    if (customerId) query.customerId = customerId;
    if (orderId) query.orderId = orderId;

    if (startDate || endDate) {
      const dateQuery: any = {};
      if (startDate) dateQuery.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateQuery.$lte = end;
      }
      query.createdAt = dateQuery;
    }

    const andConditions: any[] = [];

    if (customerType) {
      if (customerType === "B2B") {
        andConditions.push({
          $or: [
            { customerType: "B2B" },
            { 
              customerType: { $exists: false },
              $or: [
                { customerGstin: { $exists: true, $nin: [null, ""] } },
                { "shippingAddress.company": { $exists: true, $nin: [null, ""] } }
              ]
            }
          ]
        });
      } else if (customerType === "Dropshipping") {
        andConditions.push({ customerType: "Dropshipping" });
      } else {
        // B2C
        andConditions.push({
          $or: [
            { customerType: "B2C" },
            {
              customerType: { $exists: false },
              $and: [
                { $or: [{ customerGstin: { $exists: false } }, { customerGstin: null }, { customerGstin: "" }] },
                { $or: [{ "shippingAddress.company": { $exists: false } }, { "shippingAddress.company": null }, { "shippingAddress.company": "" }] }
              ]
            }
          ]
        });
      }
    }

    if (search) {
      const searchRegex = new RegExp(escapeRegex(search), "i");
      andConditions.push({
        $or: [
          { _id: searchRegex },
          { customerName: searchRegex },
          { customerEmail: searchRegex },
          { orderId: searchRegex },
          { salesperson: searchRegex },
        ]
      });
    }

    if (andConditions.length > 0) {
      query.$and = andConditions;
    }

    // Non-staff users can only see their own invoices
    if (payload.role !== "admin" && payload.role !== "manager") {
      query.customerEmail = payload.email.toLowerCase();
    }

    if (page && limit) {
      const pageNum = parseInt(page, 10) || 1;
      const limitNum = parseInt(limit, 10) || 20;
      const skip = (pageNum - 1) * limitNum;

      const [rawInvoices, total] = await Promise.all([
        InvoiceModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
        InvoiceModel.countDocuments(query),
      ]);

      const invoices = await Promise.all(rawInvoices.map((doc) => resolveDocCreatedBy(doc)));

      return NextResponse.json({
        invoices,
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum),
      });
    }

    const rawInvoices = await InvoiceModel.find(query).sort({ createdAt: -1 }).lean();
    const invoices = await Promise.all(rawInvoices.map((doc) => resolveDocCreatedBy(doc)));
    return NextResponse.json(invoices);
  } catch (error: any) {
    return NextResponse.json(
      { message: error.message || "Failed to fetch invoices" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;
    const payload = auth.payload!;

    // Only admin/manager can create invoices manually.
    const isStaff = payload.role === "admin" || payload.role === "manager";
    if (!isStaff) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }

    await dbConnect();
    const body = await request.json();
    const {
      type = "invoice",
      orderId,
      customerId,
      customerName,
      customerEmail,
      customerGstin,
      items,
      amount,
      taxDetails,
      shippingAddress,
      paymentMethod,
      paymentStatus,
      transactionId,
      notes,
      newCustomer,
      salesperson,
      status,
      dropshipDetails,
      isOrder,
    } = body;

    /**
     * A document cannot be born Paid from a wallet.
     *
     * The create form offers Store/Business Advance Balance as a payment method. Choosing one and
     * setting the status to Paid used to write exactly that — a settled document, with no
     * balance read and no ledger entry behind it. Advance Balance money moves in one place only
     * (POST /api/invoices/[id]/settle), so the document is created Pending and settled after.
     */
    if (isAdvanceBalanceMethod(paymentMethod) && paymentStatus === "Paid") {
      return NextResponse.json(
        {
          message:
            "An Advance Balance document cannot be created as Paid. Create it first, then record the payment so the balance is actually debited.",
          code: "USE_SETTLE_ENDPOINT",
        },
        { status: 400 }
      );
    }

    // Every other settled document must name how the money arrived. Without this a receipt
    // can be marked Paid with no reference at all, which is unreconcilable against a bank
    // statement and indistinguishable from the Advance Balance bug above.
    if (paymentStatus === "Paid" && type !== "quote" && !String(transactionId || "").trim()) {
      return NextResponse.json(
        { message: "A transaction reference is required when recording a document as Paid." },
        { status: 400 }
      );
    }

    if (payload.role === "manager") {
      let perms = (payload as any).permissions || [];

      // Fetch latest permissions from DB to avoid stale JWT issues
      const { default: Manager } = await import("@/models/Manager");
      const managerDoc = await Manager.findById(payload.userId).lean() as any;
      if (managerDoc && managerDoc.permissions) {
        perms = managerDoc.permissions;
      }
      
      const hasPerm = (module: string, action: string = "create") => perms.includes(module) || perms.includes(`${module}:${action}`);

      /**
       * A prepaid Tax Invoice is posted as a receipt with `isOrder`, so without this it
       * would be gated on an *orders* permission — quietly taking Tax Invoice creation away
       * from a manager holding `invoices_invoice`. The order is a consequence of issuing the
       * invoice, not a separate act, so the invoice permission governs.
       */
      if (body.docIntent === "invoice") {
        if (!hasPerm("invoices_invoice")) {
          return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }
      } else if (isOrder) {
        // Resolve target order permission based on customerType parameter (which drives orderType)
        let targetPerm = "orders_b2b";
        if (body.customerType === "Dropshipping") targetPerm = "orders_dropshipping";
        else if (body.customerType === "B2C") targetPerm = "orders_b2c";

        // Fallback mapping for legacy dropship permission name
        if (targetPerm === "orders_dropshipping" && hasPerm("orders_dropship")) {
           targetPerm = "orders_dropship";
        }

        if (!hasPerm(targetPerm)) {
          return NextResponse.json({ message: `Forbidden: Missing ${targetPerm} permission` }, { status: 403 });
        }
      } else {
        if (type === "invoice" && !hasPerm("invoices_invoice")) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        if (type === "quote" && !hasPerm("invoices_quote")) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        if (type === "receipt" && !hasPerm("invoices_receipt")) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
      }
    }

    // Handle new customer auto-creation
    let resolvedCustomerType = body.customerType || (newCustomer?.customerTypes?.[0]) || "B2C";
    let resolvedCustomerId = customerId;
    let resolvedCustomerName = customerName;
    let resolvedCustomerEmail = customerEmail;

    if (newCustomer && newCustomer.email) {
      const existingCustomer = await Customer.findOne({
        email: newCustomer.email.toLowerCase(),
      });

      if (existingCustomer) {
        resolvedCustomerId = existingCustomer._id;
        resolvedCustomerName = resolvedCustomerName || existingCustomer.name;
        resolvedCustomerEmail = existingCustomer.email;
      } else {
        // Auto-create customer
        const newCustId = await generateNextId("customer");
        const tempPassword = Math.random().toString(36).slice(-8);
        const hashedPassword = await bcrypt.hash(tempPassword, 10);

        const initials = newCustomer.name
          .split(" ")
          .map((w: string) => w[0])
          .join("")
          .toUpperCase()
          .slice(0, 2);

        await Customer.create({
          _id: newCustId,
          name: newCustomer.name,
          email: newCustomer.email.toLowerCase(),
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
          customerTypes: newCustomer.customerTypes || [resolvedCustomerType || "B2C"],
          kycStatus: (newCustomer.customerTypes?.includes("B2B") || resolvedCustomerType === "B2B") ? "Pending" : "Verified",
          isVerified: (newCustomer.customerTypes?.includes("B2B") || resolvedCustomerType === "B2B") ? false : true,
        });

        resolvedCustomerId = newCustId;
        resolvedCustomerName = resolvedCustomerName || newCustomer.name;
        resolvedCustomerEmail = newCustomer.email.toLowerCase();
      }
    }

    const sellerInfo = await getSellerInfo();
    const invoiceId = await generateInvoiceId(type);

    const generatedAt = formatDateIST(new Date());

    let defaultStatus = "paid";
    if (type === "quote") {
      defaultStatus = "draft";
    } else if (type === "receipt") {
      defaultStatus = "pending";
    }

    // Resolve customerType
    if (body.customerType) {
      resolvedCustomerType = body.customerType;
    } else if (resolvedCustomerId && resolvedCustomerId !== "legacy-sync") {
      const cust = await Customer.findById(resolvedCustomerId).lean() as any;
      if (cust && cust.customerTypes && cust.customerTypes.length > 0) {
        resolvedCustomerType = cust.customerTypes[0];
      }
    } else if (customerGstin || shippingAddress?.gstin) {
      resolvedCustomerType = "B2B";
    }

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
      if (payload.userId && /^[0-9a-fA-F]{24}$/.test(payload.userId)) {
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
        name: custName,
        email: payload.email,
        userId: payload.userId,
      };
    }

    /**
     * A receipt is always born `pending`, even when the money is already in hand.
     *
     * Recording `paymentStatus: "Paid"` here used to write a `Paid` order alongside a
     * receipt left at `pending` — the same split that made `/admin/invoices` offer "Mark
     * Paid" for money already collected. The receipt is created pending and settled a few
     * lines below through the shared settlement library, which is what issues the `INV-`
     * Tax Invoice the payment is entitled to.
     */
    const isPrepaidReceipt = type === "receipt" && paymentStatus === "Paid";
    const initialStatus = isPrepaidReceipt ? "pending" : status || defaultStatus;

    const newInvoice = await InvoiceModel.create({
      _id: invoiceId,
      type,
      orderId: orderId || undefined,
      customerId: resolvedCustomerId || undefined,
      customerName: resolvedCustomerName,
      customerEmail: resolvedCustomerEmail,
      customerGstin: customerGstin || shippingAddress?.gstin || "",
      items,
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
      paymentMethod,
      paymentStatus: isPrepaidReceipt ? "Pending" : paymentStatus,
      transactionId: isPrepaidReceipt ? undefined : transactionId,
      sellerInfo,
      notes,
      generatedAt,
      generatedBy: isStaff ? payload.email : "system",
      createdBy: resolvedCreatedBy,
      status: initialStatus,
      salesperson: salesperson || undefined,
      customerType: resolvedCustomerType,
      dropshipDetails,
    } as any);

    // Reuse the identity already resolved for createdBy, so the order's creator and the
    // first line of its fulfilment stepper can never disagree about who acted.
    const receiptActor: HistoryActor = {
      role: (resolvedCreatedBy?.role as HistoryActor["role"]) || "System",
      name: resolvedCreatedBy?.name || "System",
      userId: resolvedCreatedBy?.userId,
    };

    let linkedOrderId = orderId;

    // If it's a receipt or order created directly, auto-create the order
    if ((type === "receipt" || isOrder) && !linkedOrderId) {
      linkedOrderId = await generateNextId("order");
      const orderDate = formatDateIST(new Date());
      await Order.create({
        _id: linkedOrderId,
        date: orderDate,
        customerId: resolvedCustomerId || undefined,
        customerName: resolvedCustomerName,
        orderType: resolvedCustomerType as "B2B" | "B2C" | "Dropshipping",
        items: items,
        itemsCount: items.length,
        amount: amount,
        taxDetails: taxDetails || {
          isIntrastate: true,
          baseSubtotal: amount,
          cgst: 0,
          sgst: 0,
          igst: 0,
          hsnSlabs: [],
        },
        shippingAddress: shippingAddress,
        /**
         * Translated, not copied.
         *
         * The document keeps "Business Advance Balance"; `Order.paymentMethod` is a closed enum that
         * has no such member, so copying it across failed validation outright — "Order
         * validation failed: paymentMethod: `Business Advance Balance` is not a valid enum value" —
         * and the whole creation 500'd. The order stores `"Wallet"` and names the Advance Balance in
         * `walletType`, which is what that field is for.
         */
        paymentMethod: orderPaymentMethodFor(paymentMethod) || "Bank Transfer",
        walletType: walletTypeForMethod(paymentMethod),
        /**
         * Pending unless the caller says otherwise, and always pending for a receipt whose
         * payment is about to be settled properly below.
         *
         * The fallback here used to be `"Paid"`, so a document created without an explicit
         * payment status produced an order that claimed to be settled against nothing.
         */
        paymentStatus: isPrepaidReceipt ? "Pending" : paymentStatus || "Pending",
        status: "Processing",
        statusClass: "bg-blue-100 text-blue-700",
        invoiceId: invoiceId,
        salesperson: salesperson,
        dropshipDetails,
        createdBy: resolvedCreatedBy,
        origin: isStaff ? "self" : "website",
        // This site was missed when order history moved to buildHistoryEvent, so it still
        // wrote a legacy timestamp string and hard-coded "Admin" into the text — a manager
        // creating a receipt here was reported to admins as the admin's own action, even
        // though createdBy directly above already knew who it was.
        history: [
          buildHistoryEvent({
            status: "Processing",
            actor: receiptActor,
            customerNote: "Order received and is being prepared for dispatch.",
            internalNote: `Order created from the ${type === "receipt" ? "Receipt" : "Invoice"} generator by ${actorLabel(receiptActor)}.`,
          })
        ]
      });
      
      // Link back to the invoice
      await InvoiceModel.findByIdAndUpdate(invoiceId, { orderId: linkedOrderId });
    } else if (linkedOrderId) {
      // If linked to an existing order, update the order with the invoice ID
      await Order.findByIdAndUpdate(linkedOrderId, { invoiceId });
    }

    /**
     * Deduct stock for a Receipt or Invoice (never a quote).
     *
     * Each iteration used to be wrapped in `try { } catch { console.error }`, so a failure on
     * item 3 of 5 left items 1-2 deducted and still returned the document as created. The
     * `$elemMatch` also had no `stock: { $gte: qty }` guard, so an oversell drove the count
     * negative instead of being refused — the order route has enforced both for a while and
     * this path had drifted from it.
     *
     * Now: every line is guarded, and any failure rolls back the lines already taken before
     * the error is surfaced.
     */
    if (type !== "quote" && Array.isArray(items)) {
      const stockRollbacks: Array<{ productId: string; cvColor: string; size?: string; weight?: string; qty: number }> = [];

      try {
        for (const item of items) {
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

          const updateResult = await Product.updateOne(
            {
              _id: dbProduct._id,
              "colorVariants.color": cv.color,
              "colorVariants.subVariants": {
                // The stock guard makes the read and the decrement one operation, so two
                // concurrent documents for the last unit resolve to exactly one success.
                $elemMatch: { size: sv.size, weight: sv.weight, stock: { $gte: qty } }
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

          if (updateResult.modifiedCount === 0) {
            throw new Error(
              `Insufficient stock for "${dbProduct.title}" (${cv.color}${sv.size ? ` - ${sv.size}` : ""}).`
            );
          }

          stockRollbacks.push({
            productId: String(dbProduct._id),
            cvColor: cv.color,
            size: sv.size,
            weight: sv.weight,
            qty,
          });
        }
      } catch (stockErr) {
        for (const rb of stockRollbacks) {
          await Product.updateOne(
            {
              _id: rb.productId,
              "colorVariants.color": rb.cvColor,
              "colorVariants.subVariants": { $elemMatch: { size: rb.size, weight: rb.weight } }
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
          ).catch((rollbackErr) =>
            console.error("Failed to roll back stock after a failed document creation:", rollbackErr)
          );
        }

        // The document and its order were already written above, so remove them rather than
        // leaving a document behind that claims stock nobody has.
        await InvoiceModel.findByIdAndDelete(invoiceId).catch(() => {});
        if (linkedOrderId) await Order.findByIdAndDelete(linkedOrderId).catch(() => {});

        revalidateProductStock();
        return NextResponse.json({ message: (stockErr as Error).message }, { status: 409 });
      }

      revalidateProductStock();
    }

    /**
     * The money was already collected outside the app (cash, UPI, a bank transfer staff have
     * confirmed), so record it properly rather than stamping "Paid" on the documents.
     *
     * `issueTaxInvoiceForReceipt` mints the `INV-` Tax Invoice, marks the receipt paid and
     * links the two, then brings the order in line. Deliberately after the stock deduction:
     * that block deletes the receipt and its order when a line cannot be reserved, and an
     * issued Tax Invoice must never outlive the receipt it was issued for.
     *
     * Advance Balance methods never reach here — they are rejected further up and must go through
     * `/api/invoices/[id]/settle`, the only path that actually debits a balance.
     */
    if (isPrepaidReceipt) {
      const storedReceipt = (await InvoiceModel.findById(invoiceId).lean()) as StoredReceipt | null;
      if (storedReceipt) {
        const settled = await issueTaxInvoiceForReceipt({
          receipt: storedReceipt,
          method: paymentMethod,
          transactionId: String(transactionId || "").trim(),
          actor: {
            role: resolvedCreatedBy?.role,
            name: resolvedCreatedBy?.name,
            userId: resolvedCreatedBy?.userId,
          },
        });
        // The caller asked for a paid document; hand back the Tax Invoice, not the receipt.
        return NextResponse.json(settled.invoice, { status: 201 });
      }
    }

    /**
     * The linked order id has to be on the response.
     *
     * `newInvoice` is the document as it was *created*, and the order is linked to it a few
     * lines later with a separate `findByIdAndUpdate` — so the object returned here carried
     * no `orderId`. A caller that needs to act on the order next, like the create form
     * starting a gateway payment against it, had nothing to act on.
     */
    const created = (newInvoice as unknown as { toObject?: () => Record<string, unknown> }).toObject
      ? (newInvoice as unknown as { toObject: () => Record<string, unknown> }).toObject()
      : ({ ...(newInvoice as unknown as Record<string, unknown>) });

    return NextResponse.json({ ...created, orderId: linkedOrderId }, { status: 201 });
  } catch (error: any) {
    console.error("Invoice creation error:", error);
    return NextResponse.json(
      { message: error.message || "Failed to create invoice" },
      { status: 500 }
    );
  }
}
