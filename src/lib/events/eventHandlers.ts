import { SystemEventPayload } from "./eventDispatcher";

const NOTIFICATIONS_STORAGE_KEY = "flexsell-notifications-storage";

async function saveInAppNotification(notifData: {
  customerId: string;
  recipientRole: "customer" | "admin";
  title: string;
  message: string;
  type: "info" | "order" | "success" | "warning" | "security";
  link?: string;
  actionType?: string;
  entityId?: string;
}): Promise<void> {
  if (typeof window !== "undefined") {
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
    } catch {
      // ignore
    }
    return;
  }

  try {
    const dbConnect = (await import("../dbConnect")).default;
    const NotificationModel = (await import("@/models/Notification")).default;
    await dbConnect();
    await NotificationModel.create({
      ...notifData,
      isRead: false,
    });
  } catch (err) {
    console.error("Failed to save DB notification:", err);
  }
}

async function checkUserPreferences(
  userId: string,
  category: string
): Promise<{ push: boolean; email: boolean }> {
  if (typeof window !== "undefined") {
    return { push: true, email: true };
  }
  try {
    const dbConnect = (await import("../dbConnect")).default;
    const NotificationPreferenceModel = (await import("@/models/NotificationPreference")).default;
    await dbConnect();
    const pref = await NotificationPreferenceModel.findOne({ userId });
    if (!pref) {
      return { push: true, email: true };
    }
    const pushEnabled = pref.pushNotifications && (pref.categories as any)?.[category] !== false;
    const emailEnabled = pref.emailNotifications && (pref.categories as any)?.[category] !== false;
    return { push: pushEnabled, email: emailEnabled };
  } catch {
    return { push: true, email: true };
  }
}

export async function handleSystemEvent(event: SystemEventPayload): Promise<void> {
  if (typeof window !== "undefined") {
    return;
  }

  const { eventType, category, actor, recipient, entity, data } = event;

  console.log(`[EVENT HANDLER] Processing event ${eventType} under category ${category}`);

  // Dynamic server imports to avoid browser bundling issues
  const { emailService } = await import("../emailService");
  const { pushServiceServer } = await import("../push/pushServiceServer");

  // 1. Customer Notifications & Email Handler
  if (recipient.role === "customer" || recipient.role === "both") {
    const customerId = recipient.customerId || actor.id;
    const customerEmail = recipient.email;
    const customerName = recipient.name || "Valued Buyer";

    const prefs = await checkUserPreferences(customerId, category);

    let notifTitle = "";
    let notifMessage = "";
    let notifType: "info" | "order" | "success" | "warning" | "security" = "info";
    let deepLink = "/";
    let triggerEmailSend: () => Promise<any> = async () => {};

    switch (eventType) {
      case "AUTH_OTP_REQUESTED":
        break;

      case "AUTH_REGISTERED":
        notifTitle = "Welcome to FlexSell Wholesale!";
        notifMessage = `Your B2B buyer account (${customerId}) is active. Access tiered volume pricing and catalog specs.`;
        notifType = "success";
        deepLink = "/client/profile";
        triggerEmailSend = () =>
          emailService.sendWelcomeEmail({ _id: customerId, email: customerEmail, name: customerName });
        break;

      case "AUTH_PASSWORD_RESET_REQUESTED":
        notifTitle = "Password Reset Initiated";
        notifMessage = "A password reset link was sent to your registered email address.";
        notifType = "security";
        deepLink = "/reset-password";
        if (customerEmail && data?.resetLink) {
          triggerEmailSend = () => emailService.sendPasswordResetEmail(customerEmail, data.resetLink);
        }
        break;

      case "AUTH_PASSWORD_CHANGED":
        notifTitle = "Security Update: Password Changed";
        notifMessage = "Your account password was updated successfully.";
        notifType = "security";
        deepLink = "/login";
        if (customerEmail) {
          triggerEmailSend = () => emailService.sendPasswordChangedEmail(customerEmail);
        }
        break;

      case "PROFILE_UPDATED":
        notifTitle = "Security Update: Profile Updated";
        notifMessage = "Your account profile information was updated.";
        notifType = "security";
        deepLink = "/client/profile";
        if (customerEmail) {
          triggerEmailSend = () => emailService.sendProfileUpdatedEmail(customerEmail, customerName);
        }
        break;

      case "ADDRESS_ADDED":
        notifTitle = "Security Update: Address Book Modified";
        notifMessage = "A shipping address was added or modified in your account profile.";
        notifType = "security";
        deepLink = "/client/profile";
        if (customerEmail) {
          triggerEmailSend = () => emailService.sendAddressChangedEmail(customerEmail, customerName);
        }
        break;

      case "ORDER_CREATED":
        notifTitle = `Order Placed #${entity.id}`;
        notifMessage = `Your order #${entity.id} for ₹${Number(data?.amount || 0).toLocaleString("en-IN")} has been placed successfully.`;
        notifType = "order";
        deepLink = `/client/orders/${entity.id}`;
        if (customerEmail && data) {
          triggerEmailSend = () => emailService.sendOrderConfirmationEmail(data, customerEmail);
        }
        break;

      case "ORDER_MODIFIED":
        notifTitle = `Order #${entity.id} Details Updated`;
        notifMessage = data?.changesSummary || `Your order #${entity.id} details have been updated by our fulfillment team.`;
        notifType = "warning";
        deepLink = `/client/orders/${entity.id}`;
        if (data) {
          triggerEmailSend = () =>
            emailService.sendOrderModificationEmail(data.order || data, data.changesSummary || "Order details updated");
        }
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

        if (isShipped && data) {
          triggerEmailSend = () =>
            emailService.sendShipmentNotificationEmail(
              data.order || data,
              data.carrierName || "Delivery Partner",
              data.trackingId || "N/A",
              data.trackingUrl
            );
        } else if (customerEmail && data) {
          triggerEmailSend = () => emailService.sendPaymentStatusEmail(data, customerEmail);
        }
        break;

      case "PAYMENT_STATUS_CHANGED":
        notifTitle = `Payment Status Update #${entity.id}`;
        notifMessage = `Payment status for order #${entity.id} is now: ${data?.paymentStatus || "Updated"}`;
        notifType = data?.paymentStatus === "Paid" ? "success" : "warning";
        deepLink = `/client/orders/${entity.id}`;
        if (customerEmail && data) {
          triggerEmailSend = () => emailService.sendPaymentStatusEmail(data, customerEmail);
        }
        break;

      case "QUOTE_GENERATED":
        notifTitle = `Proforma Quote Ready #${entity.id}`;
        notifMessage = `Proforma Quote #${entity.id} for ₹${Number(data?.amount || 0).toLocaleString("en-IN")} is ready for review.`;
        notifType = "info";
        deepLink = `/client/orders/${entity.id}`;
        if (customerEmail && data) {
          triggerEmailSend = () => emailService.sendInvoiceQuoteEmail({ ...data, type: "quote" }, customerEmail);
        }
        break;

      case "INVOICE_GENERATED":
        notifTitle = `GST Tax Invoice Issued #${entity.id}`;
        notifMessage = `GST Tax Invoice #${entity.id} of ₹${Number(data?.amount || 0).toLocaleString("en-IN")} is ready for download.`;
        notifType = "success";
        deepLink = `/client/orders/${data?.orderId || entity.id}`;
        if (customerEmail && data) {
          triggerEmailSend = () => emailService.sendInvoiceQuoteEmail({ ...data, type: "invoice" }, customerEmail);
        }
        break;

      case "RECEIPT_GENERATED":
        notifTitle = `Payment Receipt Issued #${entity.id}`;
        notifMessage = `Payment Receipt #${entity.id} of ₹${Number(data?.amount || 0).toLocaleString("en-IN")} is ready for download.`;
        notifType = "success";
        deepLink = `/client/orders/${data?.orderId || entity.id}`;
        if (customerEmail && data) {
          triggerEmailSend = () => emailService.sendInvoiceQuoteEmail({ ...data, type: "receipt" }, customerEmail);
        }
        break;

      case "REVIEW_MODERATED":
        notifTitle = "Review Moderation Update";
        const approvedStatus = data?.status === "Approved" || data?.isApproved;
        notifMessage = `Your product review has been review moderated and is now ${approvedStatus ? "Approved" : "Rejected"}.`;
        notifType = approvedStatus ? "success" : "warning";
        deepLink = data?.productId ? `/products/${data.productId}` : "/";
        if (customerEmail && data) {
          triggerEmailSend = () => emailService.sendReviewModeratedEmail(data, customerEmail);
        }
        break;

      case "INQUIRY_SUBMITTED":
        notifTitle = `Inquiry Confirmed #${entity.id}`;
        notifMessage = `We received your inquiry regarding "${data?.subject || "Wholesale Quotes"}".`;
        notifType = "info";
        deepLink = "/client/support";
        if (customerEmail && data) {
          triggerEmailSend = () => emailService.sendCustomerInquiryConfirmation(data, customerEmail);
        }
        break;

      case "INQUIRY_RESPONDED":
        notifTitle = `Support Ticket Replied #${entity.id}`;
        notifMessage = `Admin replied to support ticket #${entity.id}: "${data?.subject || ""}"`;
        notifType = "info";
        deepLink = "/client/support";
        if (customerEmail && data) {
          triggerEmailSend = () => emailService.sendInquiryResponseEmail(data, data.responseText || "Replied", customerEmail);
        }
        break;
    }

    if (notifTitle && notifMessage) {
      // 1. In-App Notification
      await saveInAppNotification({
        customerId,
        recipientRole: "customer",
        title: notifTitle,
        message: notifMessage,
        type: notifType,
        link: deepLink,
        actionType: eventType,
        entityId: entity.id,
      });

      // 2. Web Push Notification (Checks Preferences)
      if (prefs.push) {
        await pushServiceServer.sendPushNotification(customerId, "customer", {
          title: notifTitle,
          body: notifMessage,
          link: deepLink,
          entityId: entity.id,
          actionType: eventType,
        });
      }

      // 3. Email Notification (Checks Preferences)
      if (prefs.email && customerEmail) {
        await triggerEmailSend();
      }
    }
  }

  // 2. Admin Notifications Handler
  if (recipient.role === "admin" || recipient.role === "both") {
    const adminPrefs = await checkUserPreferences("admin", category);

    let adminTitle = "";
    let adminMessage = "";
    let adminType: "info" | "order" | "success" | "warning" | "security" = "info";
    let adminLink = "/admin";
    let triggerAdminEmailSend: () => Promise<any> = async () => {};

    switch (eventType) {
      case "AUTH_REGISTERED":
        adminTitle = "New Buyer Registration";
        adminMessage = `New wholesale buyer "${recipient.name || "Buyer"}" (${recipient.email || ""}) registered. ID: ${entity.id}`;
        adminType = "info";
        adminLink = "/admin/customers";
        triggerAdminEmailSend = () => emailService.sendAdminNewBuyerAlert(data || { name: recipient.name, email: recipient.email, _id: entity.id });
        break;

      case "ORDER_CREATED":
        adminTitle = `New Order Placed #${entity.id}`;
        adminMessage = `Buyer ${actor.name} placed a new order #${entity.id} for ₹${Number(data?.amount || 0).toLocaleString("en-IN")}.`;
        adminType = "order";
        adminLink = `/admin/orders/${entity.id}`;
        if (data) {
          triggerAdminEmailSend = () => emailService.sendAdminNewOrderAlert(data);
        }
        break;

      case "QUOTE_ACCEPTED":
        adminTitle = `Proforma Quote Accepted #${entity.id}`;
        adminMessage = `Buyer ${actor.name} accepted proforma quote for order #${entity.id}.`;
        adminType = "success";
        adminLink = `/admin/orders/${entity.id}`;
        if (data) {
          triggerAdminEmailSend = () => emailService.sendQuoteResponseNotification(data, true);
        }
        break;

      case "QUOTE_REJECTED":
        adminTitle = `Proforma Quote Rejected #${entity.id}`;
        adminMessage = `Buyer ${actor.name} rejected proforma quote for order #${entity.id}.`;
        adminType = "warning";
        adminLink = `/admin/orders/${entity.id}`;
        if (data) {
          triggerAdminEmailSend = () => emailService.sendQuoteResponseNotification(data, false);
        }
        break;

      case "REVIEW_SUBMITTED":
        adminTitle = "New Review Needs Moderation";
        adminMessage = `Buyer ${actor.name} submitted a product review for product ${data?.productId || ""}.`;
        adminType = "warning";
        adminLink = `/admin/reviews`;
        if (data) {
          triggerAdminEmailSend = () => emailService.sendAdminReviewAlert(data);
        }
        break;

      case "INQUIRY_SUBMITTED":
        adminTitle = "New RFQ / Inquiry Submitted";
        adminMessage = `New wholesale inquiry from ${actor.name} regarding "${data?.subject || "Wholesale Quotes"}".`;
        adminType = "info";
        adminLink = `/admin/inquiries`;
        if (data) {
          triggerAdminEmailSend = () => emailService.sendAdminInquiryAlert(data);
        }
        break;
    }

    if (adminTitle && adminMessage) {
      // 1. In-App Notification for Admin
      await saveInAppNotification({
        customerId: "admin",
        recipientRole: "admin",
        title: adminTitle,
        message: adminMessage,
        type: adminType,
        link: adminLink,
        actionType: eventType,
        entityId: entity.id,
      });

      // 2. Web Push Notification for Admin (Checks Preferences)
      if (adminPrefs.push) {
        await pushServiceServer.sendPushNotification("admin", "admin", {
          title: adminTitle,
          body: adminMessage,
          link: adminLink,
          entityId: entity.id,
          actionType: eventType,
        });
      }

      // 3. Email Notification for Admin (Checks Preferences)
      if (adminPrefs.email) {
        await triggerAdminEmailSend();
      }
    }
  }
}
