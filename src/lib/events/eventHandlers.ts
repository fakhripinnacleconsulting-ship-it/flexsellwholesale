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
  if (typeof window !== "undefined" || userId === "admin") {
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
        const isWholesale = data?.customerTypes?.includes("B2B") || data?.customerTypes?.includes("Dropshipping");
        notifTitle = "Welcome to FlexSell Wholesale!";
        notifMessage = isWholesale
          ? `Your B2B buyer account (${customerId}) is active. Access tiered volume pricing and catalog specs.`
          : `Your retail account (${customerId}) is active. Start shopping now!`;
        notifType = "success";
        deepLink = "/client/profile";
        const emailForWelcome = customerEmail || data?.email;
        if (emailForWelcome) {
          triggerEmailSend = () =>
            emailService.sendWelcomeEmail({ 
              _id: customerId, 
              email: emailForWelcome, 
              name: customerName || data?.name || "Valued Buyer",
              customerTypes: data?.customerTypes || []
            });
        }
        break;

      case "ACCOUNT_UPGRADE_APPROVED":
        notifTitle = "Account Upgrade Approved";
        notifMessage = `Your request to upgrade to ${data?.newTypes?.join(" & ")} has been approved.`;
        notifType = "success";
        deepLink = "/client/profile";
        const emailForApprove = customerEmail || data?.email;
        if (emailForApprove) {
          triggerEmailSend = () => emailService.sendUpgradeApprovedEmail({ _id: customerId, email: emailForApprove, name: customerName || data?.name || "Customer" }, data?.newTypes || []);
        }
        break;

      case "ACCOUNT_UPGRADE_REJECTED":
        notifTitle = "Account Upgrade Update";
        notifMessage = `Your request for account upgrade was not approved at this time.`;
        notifType = "info";
        deepLink = "/client/profile";
        const emailForReject = customerEmail || data?.email;
        if (emailForReject) {
          triggerEmailSend = () => emailService.sendUpgradeRejectedEmail({ _id: customerId, email: emailForReject, name: customerName || data?.name || "Customer" }, data?.reason || "");
        }
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
        notifMessage = data?.changesSummary || "Your account profile information was updated.";
        notifType = "security";
        deepLink = "/client/profile";
        if (customerEmail) {
          triggerEmailSend = () => emailService.sendCustomerProfileUpdatedEmail(customerEmail, customerName, data?.updatedFields || data?.changesSummary);
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
        const orderEmail = customerEmail || data?.shippingAddress?.email || data?.customerEmail;
        if (orderEmail && data) {
          triggerEmailSend = () => emailService.sendOrderConfirmationEmail(data, orderEmail);
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

      case "ORDER_CANCELLED":
        notifTitle = `Order Cancelled #${entity.id}`;
        notifMessage = `Your wholesale purchase order #${entity.id} has been cancelled.`;
        notifType = "warning";
        deepLink = `/client/orders/${entity.id}`;
        const cancelEmail = customerEmail || data?.shippingAddress?.email || data?.order?.shippingAddress?.email;
        if (cancelEmail) {
          triggerEmailSend = () =>
            emailService.sendOrderCancellationEmail(data?.order || data || { _id: entity.id, customerName }, cancelEmail);
        }
        break;

      case "ORDER_SHIPPED":
      case "SHIPMENT_DISPATCHED":
        const carrier = data?.carrierName || data?.courierName || data?.shipmentDetails?.carrierName || "Courier Partner";
        const trackId = data?.trackingId || data?.trackingNumber || data?.shipmentDetails?.trackingId || "N/A";
        const trackUrl = data?.trackingUrl || data?.shipmentDetails?.trackingUrl;
        notifTitle = `Order Shipped #${entity.id}`;
        notifMessage = `Order #${entity.id} dispatched via ${carrier}. Tracking ID: ${trackId}`;
        notifType = "success";
        deepLink = `/client/orders/${entity.id}`;

        const shippedEmail = customerEmail || data?.shippingAddress?.email || data?.order?.shippingAddress?.email;
        if (shippedEmail) {
          triggerEmailSend = () =>
            emailService.sendShipmentNotificationEmail(
              data?.order || data || { _id: entity.id, customerName },
              carrier,
              trackId,
              trackUrl
            );
        }
        break;

      case "ORDER_STATUS_CHANGED":
        const isCancelStatus = data?.status === "Cancelled";
        const isShippedStatus = data?.status === "Shipped" || data?.status === "Dispatched";
        notifTitle = isCancelStatus
          ? `Order Cancelled #${entity.id}`
          : isShippedStatus
          ? `Order Shipped #${entity.id}`
          : `Order Status Updated #${entity.id}`;
        notifMessage = isCancelStatus
          ? `Order #${entity.id} has been cancelled.`
          : isShippedStatus
          ? `Order #${entity.id} dispatched via ${data?.carrierName || data?.shipmentDetails?.carrierName || "Courier"}. Tracking ID: ${data?.trackingId || data?.shipmentDetails?.trackingId || "N/A"}`
          : `Order #${entity.id} status changed to ${data?.status}`;
        notifType = isCancelStatus ? "warning" : isShippedStatus ? "success" : "info";
        deepLink = `/client/orders/${entity.id}`;

        const statusEmail = customerEmail || data?.shippingAddress?.email || data?.order?.shippingAddress?.email;
        if (statusEmail) {
          if (isCancelStatus) {
            triggerEmailSend = () => emailService.sendOrderCancellationEmail(data?.order || data || { _id: entity.id }, statusEmail);
          } else if (isShippedStatus) {
            triggerEmailSend = () =>
              emailService.sendShipmentNotificationEmail(
                data?.order || data || { _id: entity.id },
                data?.carrierName || data?.shipmentDetails?.carrierName || "Delivery Partner",
                data?.trackingId || data?.shipmentDetails?.trackingId || "N/A",
                data?.trackingUrl || data?.shipmentDetails?.trackingUrl
              );
          } else if (data) {
            triggerEmailSend = () => emailService.sendPaymentStatusEmail(data, statusEmail);
          }
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

      case "CART_ITEM_ADDED":
        notifTitle = "Product Added to Cart";
        notifMessage = `${data?.productTitle || "Item"} added to your wholesale cart (Qty: ${data?.quantity || 1}).`;
        notifType = "info";
        deepLink = "/cart";
        // Rule 4: Customer Notif = TRUE, Customer Mail = FALSE
        triggerEmailSend = async () => {};
        break;

      case "CART_ITEM_REMOVED":
        notifTitle = "Product Removed from Cart";
        notifMessage = `${data?.productTitle || "Item"} removed from your wholesale cart.`;
        notifType = "info";
        deepLink = "/cart";
        // Rule 4: Customer Notif = TRUE, Customer Mail = FALSE
        triggerEmailSend = async () => {};
        break;

      case "COUPON_LIVE":
        notifTitle = `New Promo Coupon Live: ${data?.code || "DISCOUNT"}`;
        notifMessage = `Use promo code "${data?.code}" to get ${data?.discountType === "percentage" ? `${data?.discountValue}% OFF` : `₹${data?.discountValue} FLAT OFF`} on your wholesale purchase!`;
        notifType = "success";
        deepLink = "/products";
        if (customerEmail && data) {
          triggerEmailSend = () => emailService.sendCouponLiveEmail(data, customerEmail);
        }
        break;

      case "REVIEW_SUBMITTED":
        notifTitle = "Review Submitted for Moderation";
        notifMessage = `Thank you! Your product review for "${data?.productTitle || data?.productId || 'item'}" was submitted successfully.`;
        notifType = "success";
        deepLink = data?.productId ? `/products/${data.productId}` : "/";
        if (customerEmail && data) {
          triggerEmailSend = () => emailService.sendCustomerReviewSubmittedEmail(data, customerEmail);
        }
        break;

      case "ACCOUNT_UPGRADE_REQUESTED":
        notifTitle = "New Upgrade Request";
        notifMessage = `${data?.name} has requested an upgrade to ${data?.requestedTypes?.join(" & ")}.`;
        notifType = "info";
        deepLink = "/admin/customers";
        // Always alert admin via email
        triggerEmailSend = () => emailService.sendAdminUpgradeRequestedAlert(
          { name: data?.name || "Customer", email: data?.email, company: data?.company },
          data?.requestedTypes || []
        );
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

      // Rule 7: Enquiry Form - Updated to send email confirmation
      case "INQUIRY_SUBMITTED":
        notifTitle = `Inquiry Received`;
        notifMessage = `We have received your wholesale inquiry regarding: "${data?.subject || "Support"}".`;
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
        // Rule 3: Updated to enable Admin Mail
        adminTitle = "New Buyer Registration";
        adminMessage = `New wholesale buyer "${recipient.name || "Buyer"}" (${recipient.email || ""}) registered. ID: ${entity.id}`;
        adminType = "info";
        adminLink = "/admin/customers";
        triggerAdminEmailSend = () => emailService.sendAdminNewBuyerAlert(data || { name: recipient.name, email: recipient.email, _id: entity.id, company: "N/A" });
        break;

      case "PROFILE_UPDATED":
        // Rule 2: Admin Notif = TRUE, Admin Mail = TRUE
        adminTitle = "Buyer Profile Updated";
        adminMessage = `Wholesale buyer ${actor.name || recipient.name || "Buyer"} updated their account profile.`;
        adminType = "security";
        adminLink = "/admin/customers";
        const buyerEmailForAdmin = recipient.email || data?.email || "";
        const buyerNameForAdmin = recipient.name || actor.name || "Buyer";
        triggerAdminEmailSend = () => emailService.sendAdminProfileUpdatedEmail(buyerNameForAdmin, buyerEmailForAdmin, data?.updatedFields || data?.changesSummary);
        break;

      case "ORDER_CREATED":
        // Rule 1: Admin Notif = TRUE, Admin Mail = TRUE
        adminTitle = `New Order Placed #${entity.id}`;
        adminMessage = `Buyer ${actor.name} placed a new order #${entity.id} for ₹${Number(data?.amount || 0).toLocaleString("en-IN")}.`;
        adminType = "order";
        adminLink = `/admin/orders/${entity.id}`;
        if (data) {
          triggerAdminEmailSend = () => emailService.sendAdminNewOrderAlert(data);
        }
        break;

      case "ORDER_STATUS_CHANGED":
      case "ORDER_SHIPPED":
      case "PAYMENT_STATUS_CHANGED":
        // Rule 1: Admin Notif = TRUE, Admin Mail = TRUE
        adminTitle = `Order #${entity.id} Status Updated`;
        adminMessage = `Order #${entity.id} status updated to: ${data?.status || data?.paymentStatus || 'Updated'}.`;
        adminType = "info";
        adminLink = `/admin/orders/${entity.id}`;
        if (data) {
          triggerAdminEmailSend = () => emailService.sendAdminOrderStatusUpdateAlert(data.order || data, data?.status || data?.paymentStatus || "Updated");
        }
        break;

      case "ORDER_CANCELLED":
        adminTitle = `Order #${entity.id} Cancelled`;
        adminMessage = `Order #${entity.id} has been cancelled.`;
        adminType = "warning";
        adminLink = `/admin/orders/${entity.id}`;
        if (data) {
          triggerAdminEmailSend = () => emailService.sendAdminOrderCancelledAlert(data.order || data || { _id: entity.id, customerName: actor.name });
        }
        break;

      case "COUPON_LIVE":
        // Rule 5: Admin Notif = TRUE, Admin Mail = FALSE
        adminTitle = `New Coupon Live: ${data?.code || 'DISCOUNT'}`;
        adminMessage = `Promo coupon "${data?.code}" is now live for buyers.`;
        adminType = "success";
        adminLink = "/admin/coupons";
        triggerAdminEmailSend = async () => {};
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
        // Rule 6: Admin Notif = TRUE, Admin Mail = TRUE
        adminTitle = "New Review Needs Moderation";
        adminMessage = `Buyer ${actor.name} submitted a product review for product ${data?.productId || ""}.`;
        adminType = "warning";
        adminLink = `/admin/reviews`;
        if (data) {
          triggerAdminEmailSend = () => emailService.sendAdminReviewAlert(data);
        }
        break;

      case "INQUIRY_SUBMITTED":
        // Rule 7: Admin Notif = TRUE, Admin Mail = TRUE
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
        try {
          await triggerAdminEmailSend();
        } catch (emailErr) {
          console.error(`[ADMIN EMAIL ALERT ERROR] Failed to dispatch email for ${eventType}:`, emailErr);
        }
      }
    }
  }
}
