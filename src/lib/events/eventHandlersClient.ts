import { SystemEventPayload } from "./eventDispatcher";
import { sendSystemOSNotification } from "../browserNotifications";

const NOTIFICATIONS_STORAGE_KEY = "flexsell-notifications-storage";

function saveClientMockNotification(notifData: {
  customerId: string;
  recipientRole: "customer" | "admin";
  title: string;
  message: string;
  type: "info" | "order" | "success" | "warning" | "security";
  link?: string;
  actionType?: string;
  entityId?: string;
}): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    list.unshift({
      _id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      ...notifData,
      isRead: false,
      createdAt: new Date().toISOString(),
    });
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(list));
  } catch (err) {
    console.error("Failed to save mock notification to localStorage:", err);
  }

  // Trigger system OS native desktop popup if allowed
  sendSystemOSNotification(notifData.title, {
    body: notifData.message,
    link: notifData.link,
  });
}

export function handleClientMockEvent(event: SystemEventPayload): void {
  const { eventType, recipient, actor, entity, data } = event;

  // 1. Save in-app notification locally for sandbox UI feedback
  if (recipient.role === "customer" || recipient.role === "both") {
    const customerId = recipient.customerId || actor.id;
    let notifTitle = "";
    let notifMessage = "";
    let notifType: "info" | "order" | "success" | "warning" | "security" = "info";
    let deepLink = "/";

    switch (eventType) {
      case "AUTH_REGISTERED":
        notifTitle = "Welcome to FlexSell Wholesale!";
        notifMessage = `Your B2B buyer account (${customerId}) is active. Access tiered volume pricing and catalog specs.`;
        notifType = "success";
        deepLink = "/client/profile";
        break;

      case "AUTH_PASSWORD_RESET_REQUESTED":
        notifTitle = "Password Reset Initiated";
        notifMessage = "A password reset link was sent to your registered email address.";
        notifType = "security";
        deepLink = "/reset-password";
        break;

      case "AUTH_PASSWORD_CHANGED":
        notifTitle = "Security Update: Password Changed";
        notifMessage = "Your account password was updated successfully.";
        notifType = "security";
        deepLink = "/login";
        break;

      case "PROFILE_UPDATED":
        notifTitle = "Security Update: Profile Updated";
        notifMessage = "Your account profile information was updated.";
        notifType = "security";
        deepLink = "/client/profile";
        break;

      case "ADDRESS_ADDED":
        notifTitle = "Security Update: Address Book Modified";
        notifMessage = "A shipping address was added or modified in your account profile.";
        notifType = "security";
        deepLink = "/client/profile";
        break;

      case "ORDER_CREATED":
        notifTitle = `Order Placed #${entity.id}`;
        notifMessage = `Your order #${entity.id} for ₹${Number(data?.amount || 0).toLocaleString("en-IN")} has been placed successfully.`;
        notifType = "order";
        deepLink = `/client/orders/${entity.id}`;
        break;

      case "ORDER_MODIFIED":
        notifTitle = `Order #${entity.id} Details Updated`;
        notifMessage = data?.changesSummary || `Your order #${entity.id} details have been updated by our fulfillment team.`;
        notifType = "warning";
        deepLink = `/client/orders/${entity.id}`;
        break;

      case "ORDER_STATUS_CHANGED":
      case "ORDER_SHIPPED":
        const isShipped = data?.status === "Shipped" || eventType === "ORDER_SHIPPED";
        notifTitle = isShipped ? `Order Shipped #${entity.id}` : `Order Status Updated #${entity.id}`;
        notifMessage = isShipped
          ? `Order #${entity.id} dispatched via ${data?.carrierName || "Courier"}. Tracking ID: ${data?.trackingId || "N/A"}`
          : `Order #${entity.id} status changed to ${data?.status}`;
        notifType = isShipped ? "success" : "info";
        deepLink = `/client/orders/${entity.id}`;
        break;

      case "PAYMENT_STATUS_CHANGED":
        notifTitle = `Payment Status Update #${entity.id}`;
        notifMessage = `Payment status for order #${entity.id} is now: ${data?.paymentStatus || "Updated"}`;
        notifType = data?.paymentStatus === "Paid" ? "success" : "warning";
        deepLink = `/client/orders/${entity.id}`;
        break;

      case "QUOTE_GENERATED":
        notifTitle = `Proforma Quote Ready #${entity.id}`;
        notifMessage = `Proforma Quote #${entity.id} for ₹${Number(data?.amount || 0).toLocaleString("en-IN")} is ready for review.`;
        notifType = "info";
        deepLink = `/client/orders/${entity.id}`;
        break;

      case "INVOICE_GENERATED":
        notifTitle = `GST Tax Invoice Issued #${entity.id}`;
        notifMessage = `GST Tax Invoice #${entity.id} of ₹${Number(data?.amount || 0).toLocaleString("en-IN")} is ready for download.`;
        notifType = "success";
        deepLink = `/client/orders/${data?.orderId || entity.id}`;
        break;

      case "RECEIPT_GENERATED":
        notifTitle = `Payment Receipt Issued #${entity.id}`;
        notifMessage = `Payment Receipt #${entity.id} of ₹${Number(data?.amount || 0).toLocaleString("en-IN")} is ready for download.`;
        notifType = "success";
        deepLink = `/client/orders/${data?.orderId || entity.id}`;
        break;

      case "REVIEW_MODERATED":
        notifTitle = "Review Moderation Update";
        const approvedStatus = data?.status === "Approved" || data?.isApproved;
        notifMessage = `Your product review has been review moderated and is now ${approvedStatus ? "Approved" : "Rejected"}.`;
        notifType = approvedStatus ? "success" : "warning";
        deepLink = data?.productId ? `/products/${data.productId}` : "/";
        break;

      case "INQUIRY_SUBMITTED":
        notifTitle = `Inquiry Confirmed #${entity.id}`;
        notifMessage = `We received your inquiry regarding "${data?.subject || "Wholesale Quotes"}".`;
        notifType = "info";
        deepLink = "/client/support";
        break;

      case "INQUIRY_RESPONDED":
        notifTitle = `Support Ticket Replied #${entity.id}`;
        notifMessage = `Admin replied to support ticket #${entity.id}: "${data?.subject || ""}"`;
        notifType = "info";
        deepLink = "/client/support";
        break;
    }

    if (notifTitle && notifMessage) {
      saveClientMockNotification({
        customerId,
        recipientRole: "customer",
        title: notifTitle,
        message: notifMessage,
        type: notifType,
        link: deepLink,
        actionType: eventType,
        entityId: entity.id,
      });
    }
  }

  // 2. Save admin notification locally
  if (recipient.role === "admin" || recipient.role === "both") {
    let adminTitle = "";
    let adminMessage = "";
    let adminType: "info" | "order" | "success" | "warning" | "security" = "info";
    let adminLink = "/admin";

    switch (eventType) {
      case "AUTH_REGISTERED":
        adminTitle = "New Buyer Registration";
        adminMessage = `New wholesale buyer "${recipient.name || "Buyer"}" (${recipient.email || ""}) registered. ID: ${entity.id}`;
        adminType = "info";
        adminLink = "/admin/customers";
        break;

      case "ORDER_CREATED":
        adminTitle = `New Order Placed #${entity.id}`;
        adminMessage = `Buyer ${actor.name} placed a new order #${entity.id} for ₹${Number(data?.amount || 0).toLocaleString("en-IN")}.`;
        adminType = "order";
        adminLink = `/admin/orders/${entity.id}`;
        break;

      case "QUOTE_ACCEPTED":
        adminTitle = `Proforma Quote Accepted #${entity.id}`;
        adminMessage = `Buyer ${actor.name} accepted proforma quote for order #${entity.id}.`;
        adminType = "success";
        adminLink = `/admin/orders/${entity.id}`;
        break;

      case "QUOTE_REJECTED":
        adminTitle = `Proforma Quote Rejected #${entity.id}`;
        adminMessage = `Buyer ${actor.name} rejected proforma quote for order #${entity.id}.`;
        adminType = "warning";
        adminLink = `/admin/orders/${entity.id}`;
        break;

      case "REVIEW_SUBMITTED":
        adminTitle = "New Review Needs Moderation";
        adminMessage = `Buyer ${actor.name} submitted a product review for product ${data?.productId || ""}.`;
        adminType = "warning";
        adminLink = `/admin/reviews`;
        break;

      case "INQUIRY_SUBMITTED":
        adminTitle = "New RFQ / Inquiry Submitted";
        adminMessage = `New wholesale inquiry from ${actor.name} regarding "${data?.subject || "Wholesale Quotes"}".`;
        adminType = "info";
        adminLink = `/admin/inquiries`;
        break;
    }

    if (adminTitle && adminMessage) {
      saveClientMockNotification({
        customerId: "admin",
        recipientRole: "admin",
        title: adminTitle,
        message: adminMessage,
        type: adminType,
        link: adminLink,
        actionType: eventType,
        entityId: entity.id,
      });
    }
  }

  // 3. Dispatch event to server endpoint asynchronously so Nodemailer SMTP email & Web Push notifications are dispatched
  if (typeof window !== "undefined" && typeof fetch !== "undefined") {
    fetch("/api/events/dispatch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    }).catch((err) => {
      console.warn("Failed to dispatch server event from client:", err);
    });
  }
}
