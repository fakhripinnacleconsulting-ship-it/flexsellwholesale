import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import InvoiceModel from "@/models/Invoice";
import Customer from "@/models/Customer";
import Order from "@/models/Order";
import Product from "@/models/Product";
import CmsContent from "@/models/CmsContent";
import Manager from "@/models/Manager";
import { requireAuth } from "@/lib/authGuard";
import { generateNextId } from "@/lib/idGeneratorServer";
import { computeOrderTaxDetails, resolveSellerState } from "@/lib/orderTotals";
import { resolveVariantKeys } from "@/lib/variantMatcher";
import { revalidateProducts } from "@/lib/revalidate";
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

async function generateInvoiceId(type: "invoice" | "receipt" | "quote"): Promise<string> {
  return generateNextId(type);
}

async function syncMissingInvoicesForOrders() {
  try {
    // Find all orders that do not have an invoiceId or whose invoiceId doesn't exist
    const orders = await Order.find({
      $or: [
        { invoiceId: { $exists: false } },
        { invoiceId: "" },
        { invoiceId: null }
      ]
    }).lean();

    if (orders.length === 0) return;

    const sellerInfo = await getSellerInfo();
    const sellerState = resolveSellerState(sellerInfo.address);

    for (const order of orders as any[]) {
      // Check if an invoice document already exists for this orderId (to prevent duplicates)
      const existingDoc = await InvoiceModel.findOne({ orderId: order._id }).select("_id").lean();
      if (existingDoc) {
        // Just link it
        await Order.findByIdAndUpdate(order._id, { invoiceId: (existingDoc as any)._id });
        continue;
      }

      // Generate invoice/receipt
      const pStatus = order.paymentStatus || "Pending";
      const docType = pStatus === "Paid" ? "invoice" : "receipt";
      
      const taxDetails = computeOrderTaxDetails(order.items, order.shippingAddress.state, sellerState);
      const invoiceId = await generateInvoiceId(docType);
      
      // Parse generated date from order.date or fallback to current date
      let parsedDate = order.date;
      if (!parsedDate || parsedDate === "N/A") {
        parsedDate = new Date().toLocaleDateString("en-IN", {
          day: "2-digit", month: "long", year: "numeric",
        });
      }

      const customerDoc = await Customer.findOne({ email: order.shippingAddress.email.toLowerCase() }).select("_id customerTypes").lean() as any;
      const customerId = customerDoc?._id ? String(customerDoc._id) : "legacy-sync";
      const resolvedCustomerType = customerDoc?.customerTypes?.[0] || (order.shippingAddress.company || order.shippingAddress.gstin ? "B2B" : "B2C");

      await InvoiceModel.create({
        _id: invoiceId,
        type: docType,
        orderId: order._id,
        customerId,
        customerName: order.customerName,
        customerEmail: order.shippingAddress.email.toLowerCase(),
        customerGstin: order.shippingAddress.gstin || "",
        items: order.items as any,
        amount: order.amount,
        taxDetails,
        shippingAddress: order.shippingAddress as any,
        paymentMethod: order.paymentMethod,
        paymentStatus: pStatus,
        transactionId: order.transactionId,
        sellerInfo,
        generatedAt: parsedDate,
        generatedBy: "system",
        status: docType === "invoice" ? "paid" : "pending",
        customerType: resolvedCustomerType,
      } as any);

      // Update order
      await Order.findByIdAndUpdate(order._id, { invoiceId });
    }
  } catch (err) {
    console.error("Failed to sync missing invoices for orders:", err);
  }
}

export async function GET(request: Request) {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;
    const payload = auth.payload!;

    await dbConnect();
    // Removed syncMissingInvoicesForOrders() to prevent auto-recreation of deleted receipts 
    // and to improve performance. Migration should be handled manually if needed.

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

    const query: any = {};
    
    if (payload.role === "manager") {
      let perms = (payload as any).permissions || [];
      const managerUser = await Manager.findById(payload.userId).lean();
      if (managerUser) {
        perms = managerUser.permissions || [];
      }
      
      const hasInvoices = perms.includes("invoices_invoice");
      const hasQuotes = perms.includes("invoices_quote");
      const hasReceipts = perms.includes("invoices_receipt");
      
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

      const [invoices, total] = await Promise.all([
        InvoiceModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
        InvoiceModel.countDocuments(query),
      ]);

      return NextResponse.json({
        invoices,
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum),
      });
    }

    const invoices = await InvoiceModel.find(query).sort({ createdAt: -1 }).lean();
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

    if (payload.role === "manager") {
      let perms = (payload as any).permissions || [];
      
      // Fetch latest permissions from DB to avoid stale JWT issues
      const { default: Manager } = await import("@/models/Manager");
      const managerDoc = await Manager.findById(payload.userId).lean() as any;
      if (managerDoc && managerDoc.permissions) {
        perms = managerDoc.permissions;
      }
      
      const hasPerm = (module: string, action: string = "create") => perms.includes(module) || perms.includes(`${module}:${action}`);

      if (isOrder) {
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

    const generatedAt = new Date().toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

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
      paymentStatus,
      transactionId,
      sellerInfo,
      notes,
      generatedAt,
      generatedBy: isStaff ? payload.email : "system",
      status: status || defaultStatus,
      salesperson: salesperson || undefined,
      customerType: resolvedCustomerType,
      dropshipDetails,
    } as any);

    let linkedOrderId = orderId;

    // If it's a receipt or order created directly, auto-create the order
    if ((type === "receipt" || isOrder) && !linkedOrderId) {
      linkedOrderId = await generateNextId("order");
      const orderDate = new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
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
        paymentMethod: paymentMethod || "Bank Transfer",
        paymentStatus: paymentStatus || "Paid",
        status: "Processing",
        statusClass: "bg-blue-100 text-blue-700",
        invoiceId: invoiceId,
        salesperson: salesperson,
        dropshipDetails,
        history: [{
          status: "Processing",
          description: "Order created directly from Admin Receipt generator.",
          timestamp: new Date().toISOString()
        }]
      });
      
      // Link back to the invoice
      await InvoiceModel.findByIdAndUpdate(invoiceId, { orderId: linkedOrderId });
    } else if (linkedOrderId) {
      // If linked to an existing order, update the order with the invoice ID
      await Order.findByIdAndUpdate(linkedOrderId, { invoiceId });
    }

    // Deduct stock for ordered items when an Admin creates a Receipt or Invoice (not a quote)
    if (type !== "quote" && Array.isArray(items)) {
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
          console.error("Failed to deduct stock during admin document creation:", err);
        }
      }
      revalidateProducts();
    }

    return NextResponse.json(newInvoice, { status: 201 });
  } catch (error: any) {
    console.error("Invoice creation error:", error);
    return NextResponse.json(
      { message: error.message || "Failed to create invoice" },
      { status: 500 }
    );
  }
}
