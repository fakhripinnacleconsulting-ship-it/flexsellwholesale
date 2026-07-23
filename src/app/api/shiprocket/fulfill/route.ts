import { NextResponse, NextRequest } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Order from "@/models/Order";
import Product from "@/models/Product";
import Customer from "@/models/Customer";
import { verifyToken, getTokenFromCookie } from "@/lib/auth";
import { shiprocketClient } from "@/lib/shiprocketClient";
import { dispatchWebhook } from "@/lib/webhookDispatcher";
import { ORDER_STATUS_CLASSES } from "@/lib/constants";

export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    const token = await getTokenFromCookie();
    if (!token) {
      return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload || payload.role !== "admin") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const { orderId, courierId } = await request.json();
    if (!orderId) {
      return NextResponse.json({ message: "Order ID is required" }, { status: 400 });
    }

    const order: any = await Order.findById(orderId);
    if (!order) {
      return NextResponse.json({ message: "Order not found" }, { status: 404 });
    }

    // Step 0: Pre-flight validation for numeric weight and dimensions
    const creds = await shiprocketClient.getCredentials();
    const orderItemsPayload: any[] = [];
    const missingFields: any[] = [];
    let totalWeightGrams = 0;
    let maxLen = 10, maxBrd = 10, maxHgt = 10;

    for (const item of order.items) {
      const liveProd = await Product.findById(item.productId || item.product?._id).lean() as any;
      const colorName = item.selectedVariants?.Color || item.selectedVariants?.color || "";
      const sizeName = item.selectedVariants?.Size || item.selectedVariants?.size || "";

      const matchedColor = liveProd?.colorVariants?.find((cv: any) => cv.color?.toLowerCase() === colorName.toLowerCase()) || liveProd?.colorVariants?.[0];
      const matchedSub = matchedColor?.subVariants?.find((sv: any) => (!sizeName || sv.size?.toLowerCase() === sizeName.toLowerCase())) || matchedColor?.subVariants?.[0];

      const weightGrams = matchedSub?.weightGrams ?? null;
      const lengthCm = matchedColor?.lengthCm ?? null;
      const breadthCm = matchedColor?.breadthCm ?? null;
      const heightCm = matchedColor?.heightCm ?? null;

      const missing: string[] = [];
      if (!weightGrams || weightGrams <= 0) missing.push("weightGrams");
      if (!lengthCm || lengthCm <= 0) missing.push("lengthCm");
      if (!breadthCm || breadthCm <= 0) missing.push("breadthCm");
      if (!heightCm || heightCm <= 0) missing.push("heightCm");

      if (missing.length > 0) {
        missingFields.push({
          productTitle: item.product?.title || "Product",
          variant: `${colorName} / ${sizeName}`,
          missing
        });
      } else {
        totalWeightGrams += (weightGrams * item.quantity);
        maxLen = Math.max(maxLen, lengthCm);
        maxBrd = Math.max(maxBrd, breadthCm);
        maxHgt = Math.max(maxHgt, heightCm);

        orderItemsPayload.push({
          name: item.product?.title || "Item",
          sku: matchedSub?.sku || `SKU-${item.id}`,
          units: item.quantity,
          selling_price: item.pricePerUnit,
          discount: 0,
          tax: 0,
          hsn: liveProd?.hsnCode || 3924,
          weightGrams,
          lengthCm,
          breadthCm,
          heightCm
        });
      }
    }

    if (missingFields.length > 0) {
      const details = missingFields.map(m => `'${m.productTitle}' (${m.variant}): missing ${m.missing.join(", ")}`).join("; ");
      return NextResponse.json({
        success: false,
        step: "validation",
        error: `Cannot create Shiprocket order. Missing numeric specs: ${details}. Please update the product specs in admin.`,
        missingFields
      }, { status: 400 });
    }

    const orderDateStr = order.createdAt ? new Date(order.createdAt).toISOString().split("T")[0] : new Date().toISOString().split("T")[0];

    const srOrderPayload = {
      order_id: order._id,
      order_date: orderDateStr,
      pickup_location: creds.pickupAddress?.name || "Primary Warehouse",
      channel_id: creds.channelId || "",
      billing_customer_name: order.shippingAddress.firstName,
      billing_last_name: order.shippingAddress.lastName,
      billing_address: order.shippingAddress.address,
      billing_address_2: order.shippingAddress.apartment || "",
      billing_city: order.shippingAddress.city,
      billing_pincode: order.shippingAddress.pinCode,
      billing_state: order.shippingAddress.state,
      billing_country: "India",
      billing_email: order.shippingAddress.email,
      billing_phone: order.shippingAddress.phone,
      shipping_is_billing: true,
      order_items: orderItemsPayload.map(i => ({
        name: i.name,
        sku: i.sku,
        units: i.units,
        selling_price: i.selling_price,
        discount: i.discount,
        tax: i.tax,
        hsn: i.hsn
      })),
      payment_method: order.paymentMethod === "COD" ? "COD" : "Prepaid",
      sub_total: order.amount,
      length: maxLen,
      breadth: maxBrd,
      height: maxHgt,
      weight: Math.max(0.1, totalWeightGrams / 1000), // convert to kg
    };

    // Initialize Shiprocket tracking in order if not present
    order.shipmentDetails = order.shipmentDetails || {
      type: "shiprocket",
      trackingId: `SR-PENDING-${order._id}`,
    };
    order.shipmentDetails.type = "shiprocket";
    order.shipmentDetails.shiprocket = order.shipmentDetails.shiprocket || {};

    // STEP 1: Create Order in Shiprocket
    let srOrderRes: any;
    try {
      srOrderRes = await shiprocketClient.createAdhocOrder(srOrderPayload);
      const srOrderId = srOrderRes.order_id;
      const srShipmentId = srOrderRes.shipment_id;

      order.shipmentDetails.shiprocket.orderId = srOrderId;
      order.shipmentDetails.shiprocket.shipmentId = srShipmentId;
      order.shipmentDetails.shiprocket.fulfillmentStep = "order_created";
      order.shipmentDetails.shiprocket.failedAt = null;
      order.shipmentDetails.shiprocket.failureReason = null;
      
      order.status = "Awaiting Shipment";
      order.statusClass = ORDER_STATUS_CLASSES["Awaiting Shipment"];
      await order.save();
    } catch (err: any) {
      order.shipmentDetails.shiprocket.failedAt = "order_create";
      order.shipmentDetails.shiprocket.failureReason = err.message;
      await order.save();
      return NextResponse.json({
        success: false,
        step: "order_create",
        error: `Order Creation Failed: ${err.message}`
      }, { status: 500 });
    }

    const shipmentId = order.shipmentDetails.shiprocket.shipmentId;

    // STEP 2: Assign AWB
    let awbRes: any;
    try {
      awbRes = await shiprocketClient.assignAwb(shipmentId, courierId ? Number(courierId) : undefined);
      const awbCode = awbRes?.response?.data?.awb_code || awbRes?.awb_code;
      const courierName = awbRes?.response?.data?.courier_name || awbRes?.courier_name || "Shiprocket Partner";

      if (!awbCode) {
        throw new Error(awbRes?.message || "AWB assignment did not return a valid tracking code.");
      }

      order.shipmentDetails.trackingId = awbCode;
      order.shipmentDetails.carrierName = courierName;
      order.shipmentDetails.trackingUrl = `https://shiprocket.co/tracking/${awbCode}`;

      order.shipmentDetails.shiprocket.awbCode = awbCode;
      order.shipmentDetails.shiprocket.courierId = courierId ? Number(courierId) : (awbRes?.response?.data?.courier_company_id || null);
      order.shipmentDetails.shiprocket.courierName = courierName;
      order.shipmentDetails.shiprocket.trackingUrl = `https://shiprocket.co/tracking/${awbCode}`;
      order.shipmentDetails.shiprocket.fulfillmentStep = "awb_assigned";
      order.shipmentDetails.shiprocket.failedAt = null;
      order.shipmentDetails.shiprocket.failureReason = null;
      await order.save();
    } catch (err: any) {
      order.shipmentDetails.shiprocket.failedAt = "awb_assign";
      order.shipmentDetails.shiprocket.failureReason = err.message;
      await order.save();
      return NextResponse.json({
        success: false,
        step: "awb_assign",
        error: `AWB Assignment Failed: ${err.message}`,
        order
      }, { status: 500 });
    }

    // STEP 3: Schedule Pickup
    try {
      const pickupRes = await shiprocketClient.schedulePickup(shipmentId);
      const pickupDate = pickupRes?.response?.pickup_date || new Date().toISOString().split("T")[0];
      const tokenNo = pickupRes?.response?.pickup_token_number || "";

      order.shipmentDetails.shiprocket.pickupScheduledDate = pickupDate;
      order.shipmentDetails.shiprocket.pickupTokenNumber = tokenNo;
      order.shipmentDetails.shiprocket.fulfillmentStep = "pickup_scheduled";
      order.shipmentDetails.shiprocket.failedAt = null;
      order.shipmentDetails.shiprocket.failureReason = null;
      await order.save();
    } catch (err: any) {
      order.shipmentDetails.shiprocket.failedAt = "pickup_schedule";
      order.shipmentDetails.shiprocket.failureReason = err.message;
      await order.save();
      return NextResponse.json({
        success: false,
        step: "pickup_schedule",
        error: `Pickup Schedule Failed: ${err.message}`,
        order
      }, { status: 500 });
    }

    // STEP 4: Generate Label (Non-critical)
    try {
      const labelRes = await shiprocketClient.generateLabel([shipmentId]);
      if (labelRes?.label_created || labelRes?.label_url) {
        order.shipmentDetails.shiprocket.labelUrl = labelRes.label_url;
      }
    } catch (err: any) {
      console.warn("[Shiprocket] Label generation warning:", err.message);
    }

    order.shipmentDetails.shiprocket.fulfillmentStep = "complete";
    order.shipmentDetails.shippedAt = new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });

    const timestamp = new Date().toLocaleString("en-US", {
      month: "short", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
    });

    order.history.unshift({
      status: "Awaiting Shipment",
      timestamp,
      description: `Order dispatched via Shiprocket. Courier: ${order.shipmentDetails.shiprocket.courierName}. AWB: ${order.shipmentDetails.shiprocket.awbCode}. Awaiting carrier pickup.`
    });

    await order.save();

    // Dispatch Webhook Notification to customer
    const targetCustomerId = (await Customer.findOne({ email: order.shippingAddress.email.toLowerCase() }).select("_id"))?._id || "";
    dispatchWebhook("order.status_updated", order, targetCustomerId, {
      title: "Order Dispatched via Shiprocket",
      message: `Your wholesale order ${order._id} has been processed for shipping via ${order.shipmentDetails.shiprocket.courierName}. AWB Tracking Code: ${order.shipmentDetails.shiprocket.awbCode}.`,
      type: "order"
    }).catch(console.error);

    return NextResponse.json({ success: true, order });
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "Shiprocket fulfillment failed" }, { status: 500 });
  }
}

// PUT handler to retry failed fulfillment step [UPDATED-5]
export async function PUT(request: NextRequest) {
  try {
    await dbConnect();
    const token = await getTokenFromCookie();
    if (!token) {
      return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload || payload.role !== "admin") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const { orderId, courierId } = await request.json();
    const order: any = await Order.findById(orderId);
    if (!order || !order.shipmentDetails?.shiprocket) {
      return NextResponse.json({ message: "Order or Shiprocket data not found" }, { status: 404 });
    }

    const sr = order.shipmentDetails.shiprocket;
    const failedAt = sr.failedAt;

    if (!failedAt) {
      return NextResponse.json({ message: "No failed fulfillment step to retry." }, { status: 400 });
    }

    // Resume from failed step
    if (failedAt === "awb_assign" && sr.shipmentId) {
      const awbRes = await shiprocketClient.assignAwb(sr.shipmentId, courierId ? Number(courierId) : undefined);
      const awbCode = awbRes?.response?.data?.awb_code || awbRes?.awb_code;
      const courierName = awbRes?.response?.data?.courier_name || awbRes?.courier_name || "Shiprocket Partner";

      if (!awbCode) throw new Error(awbRes?.message || "AWB retry failed.");

      order.shipmentDetails.trackingId = awbCode;
      order.shipmentDetails.carrierName = courierName;
      order.shipmentDetails.trackingUrl = `https://shiprocket.co/tracking/${awbCode}`;

      sr.awbCode = awbCode;
      sr.courierName = courierName;
      sr.fulfillmentStep = "awb_assigned";
      sr.failedAt = null;
      sr.failureReason = null;
      await order.save();

      // Proceed to pickup
      try {
        const pickupRes = await shiprocketClient.schedulePickup(sr.shipmentId);
        sr.pickupScheduledDate = pickupRes?.response?.pickup_date || new Date().toISOString().split("T")[0];
        sr.fulfillmentStep = "pickup_scheduled";
      } catch (err: any) {
        sr.failedAt = "pickup_schedule";
        sr.failureReason = err.message;
        await order.save();
        return NextResponse.json({ success: false, step: "pickup_schedule", error: err.message, order }, { status: 500 });
      }
    } else if (failedAt === "pickup_schedule" && sr.shipmentId) {
      const pickupRes = await shiprocketClient.schedulePickup(sr.shipmentId);
      sr.pickupScheduledDate = pickupRes?.response?.pickup_date || new Date().toISOString().split("T")[0];
      sr.fulfillmentStep = "pickup_scheduled";
      sr.failedAt = null;
      sr.failureReason = null;
      await order.save();
    }

    sr.fulfillmentStep = "complete";
    await order.save();

    return NextResponse.json({ success: true, order });
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "Retry fulfillment failed" }, { status: 500 });
  }
}
