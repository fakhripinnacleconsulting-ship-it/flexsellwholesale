import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import InvoiceModel from "@/models/Invoice";
import Customer from "@/models/Customer";
import Order from "@/models/Order";
import Product from "@/models/Product";
import CmsContent from "@/models/CmsContent";
import { generateNextId } from "@/lib/idGeneratorServer";
import { resolveVariantKeys } from "@/lib/variantMatcher";
import { revalidateAdminDashboard, revalidateProducts } from "@/lib/revalidate";
import { rateLimit } from "@/lib/rateLimit";
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

    const generatedAt = new Date().toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    const orderDate = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

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
      paymentStatus,
      transactionId: transactionId || undefined,
      sellerInfo,
      notes,
      generatedAt,
      generatedBy: "website-public",
      status: paymentStatus === "Paid" ? "paid" : "pending",
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
      paymentMethod: paymentMethod || "COD",
      paymentStatus: paymentStatus || "Pending",
      status: "Processing",
      statusClass: "bg-blue-100 text-blue-700",
      invoiceId,
      salesperson: salesperson || undefined,
      dropshipDetails,
      history: [{
        status: "Processing",
        description: "Dropshipping order created via Public Portal.",
        timestamp: new Date().toISOString()
      }]
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
      revalidateProducts();
    }

    return NextResponse.json({
      message: "Dropshipping order created successfully",
      orderId: (newOrder as any)._id || orderId,
      invoiceId,
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
