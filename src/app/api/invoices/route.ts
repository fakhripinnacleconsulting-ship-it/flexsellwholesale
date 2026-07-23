import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import InvoiceModel from "@/models/Invoice";
import Customer from "@/models/Customer";
import Order from "@/models/Order";
import CmsContent from "@/models/CmsContent";
import { requireAuth } from "@/lib/authGuard";
import { generateNextId } from "@/lib/idGeneratorServer";
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

function computeOrderTaxDetails(items: any[], buyerState: string, sellerState: string) {
  const isIntrastate = buyerState?.toLowerCase() === sellerState?.toLowerCase();
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
    const sellerState = sellerInfo.address.match(/(?:,\s*)([A-Za-z\s]+?)(?:\s*-\s*\d|$)/)?.[1]?.trim() || "Madhya Pradesh";

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

    await dbConnect();
    await syncMissingInvoicesForOrders();

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
    if (type) query.type = type;
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
      const searchRegex = new RegExp(search, "i");
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

    // Non-admin users can only see their own invoices
    const payload = auth.payload!;
    if (payload.role !== "admin") {
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

    // Only admin can create invoices manually
    if (payload.role !== "admin" && !request.headers.get("x-system-call")) {
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
      status
    } = body;

    // Handle new customer auto-creation
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
          customerTypes: newCustomer.customerTypes || ["B2C"],
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
    let resolvedCustomerType = "B2C";
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
      generatedBy: payload.role === "admin" ? payload.email : "system",
      status: status || defaultStatus,
      salesperson: salesperson || undefined,
      customerType: resolvedCustomerType,
    } as any);

    // If linked to an order, update the order with the invoice ID
    if (orderId) {
      await Order.findByIdAndUpdate(orderId, { invoiceId });
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
