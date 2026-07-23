import nodemailer from "nodemailer";

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  category?: string;
}

const EMAIL_LOGS_KEY = "flexsell-email-logs-storage";

export function logEmailToStorage(emailOpt: EmailOptions): void {
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(EMAIL_LOGS_KEY);
      const logs = raw ? JSON.parse(raw) : [];
      logs.unshift({
        id: `email-${Date.now()}`,
        to: emailOpt.to,
        subject: emailOpt.subject,
        category: emailOpt.category || "general",
        sentAt: new Date().toISOString(),
        previewText: emailOpt.subject,
      });
      localStorage.setItem(EMAIL_LOGS_KEY, JSON.stringify(logs.slice(0, 50)));
    } catch {
      // ignore
    }
  }
}

function getSmtpConfig() {
  let host = process.env.SMTP_HOST || "smtp.gmail.com";
  let port = parseInt(process.env.SMTP_PORT || "465", 10);
  let user = process.env.SMTP_USER || "mauryatech7@gmail.com";
  let pass = process.env.SMTP_PASS || "qfxgglqfymjhbksy";

  try {
    const fs = require("fs");
    const path = require("path");
    const envPath = path.resolve(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf8");
      const hostMatch = content.match(/^SMTP_HOST=(.*)$/m);
      if (hostMatch && hostMatch[1]) host = hostMatch[1].trim();

      const portMatch = content.match(/^SMTP_PORT=(.*)$/m);
      if (portMatch && portMatch[1]) port = parseInt(portMatch[1].trim(), 10);

      const userMatch = content.match(/^SMTP_USER=(.*)$/m);
      if (userMatch && userMatch[1]) user = userMatch[1].trim();

      const passMatch = content.match(/^SMTP_PASS=(.*)$/m);
      if (passMatch && passMatch[1]) pass = passMatch[1].trim();
    }
  } catch {
    // fallback
  }

  const cleanHost = host.replace(/["'\s]/g, "") || "smtp.gmail.com";
  const cleanPort = isNaN(port) ? 465 : port;
  const cleanUser = user.replace(/["'\s]/g, "") || "mauryatech7@gmail.com";
  const cleanPass = pass.replace(/["'\s]/g, "") || "qfxgglqfymjhbksy";

  return { host: cleanHost, port: cleanPort, user: cleanUser, pass: cleanPass };
}

export const emailService = {
  async sendEmail(options: EmailOptions): Promise<boolean> {
    const config = getSmtpConfig();
    const smtpHost = config.host;
    const smtpUser = config.user;
    const smtpPass = config.pass;
    const smtpPort = config.port;

    // Logging for dev / mock environment
    console.log("\n=======================================================");
    console.log(`[EMAIL DISPATCH] To: ${options.to}`);
    console.log(`[SUBJECT]: ${options.subject}`);
    console.log(`[SMTP CONFIG]: host=${smtpHost}, port=${smtpPort}, user=${smtpUser}, passLength=${smtpPass.length}`);
    console.log("=======================================================\n");

    logEmailToStorage(options);

    if (!smtpHost || !smtpUser || !smtpPass) {
      console.log(`[EMAIL DISPATCHER] SMTP credentials not configured. Email logged to console/storage for sandbox testing.`);
      return true;
    }

    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
        tls: {
          rejectUnauthorized: false
        }
      });

      await transporter.sendMail({
        from: `"FlexSell Wholesale Support" <${smtpUser}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || options.subject,
      });

      console.log(`[EMAIL SUCCESS] Dispatched email successfully to ${options.to}`);
      return true;
    } catch (err: any) {
      console.error(`[EMAIL DISPATCH ERROR] Failed to send email to ${options.to}:`, err.message);
      // Return true so business transactions don't fail due to mail server timeouts
      return false;
    }
  },

  // Get Admin recipient email
  getAdminEmail(): string {
    return process.env.SUPPORT_EMAIL || process.env.SMTP_USER || "mauryatech7@gmail.com";
  },

  // 1. Pre-Registration OTP Verification Email
  async sendRegisterOtp(email: string, otpCode: string, name: string): Promise<boolean> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <div style="background-color: #0f172a; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h2 style="color: #10b981; margin: 0; font-size: 24px; letter-spacing: -0.5px;">FlexSell Wholesale B2B</h2>
          <p style="color: #94a3b8; margin: 4px 0 0 0; font-size: 12px;">Email Verification Code</p>
        </div>
        <div style="padding: 24px; color: #334155;">
          <p style="font-size: 16px; margin-top: 0;">Hello <strong>${name || "Valued Buyer"}</strong>,</p>
          <p>Thank you for initiating registration with FlexSell Wholesale. Use the following 6-digit verification code to complete your B2B account setup:</p>
          
          <div style="text-align: center; margin: 32px 0;">
            <span style="font-family: monospace; font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #059669; background-color: #ecfdf5; padding: 12px 28px; border-radius: 8px; border: 2px dashed #10b981;">${otpCode}</span>
          </div>

          <p style="font-size: 13px; color: #64748b; text-align: center;">This code is valid for <strong>10 minutes</strong>. Never share this verification code with anyone.</p>
        </div>
        <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; text-align: center; font-size: 12px; color: #94a3b8;">
          FlexSell Wholesale © 2026. All rights reserved.
        </div>
      </div>
    `;
    return this.sendEmail({ to: email, subject: `${otpCode} is your FlexSell Wholesale Email Verification Code`, html, category: "security" });
  },

  // 2. Welcome Email
  async sendWelcomeEmail(customer: any): Promise<boolean> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
        <div style="background-color: #0f172a; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h2 style="color: #10b981; margin: 0;">Welcome to FlexSell Wholesale!</h2>
        </div>
        <div style="padding: 24px; color: #334155;">
          <p>Hello <strong>${customer.name}</strong>,</p>
          <p>Your B2B buyer account (ID: <strong>${customer._id}</strong>) is now active.</p>
          <p>You can now log in to access tiered wholesale pricing, request proforma quotes, and manage bulk purchase orders.</p>
        </div>
      </div>
    `;
    return this.sendEmail({ to: customer.email, subject: "Welcome to FlexSell Wholesale - Account Activated", html, category: "security" });
  },

  // 3. Admin New Buyer Alert Email
  async sendAdminNewBuyerAlert(customer: any): Promise<boolean> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
        <div style="background-color: #0f172a; padding: 20px; text-align: center;">
          <h2 style="color: #10b981; margin: 0;">New Wholesale Buyer Registered</h2>
        </div>
        <div style="padding: 24px; color: #334155;">
          <p>Hello Admin,</p>
          <p>A new buyer has registered on FlexSell Wholesale:</p>
          <ul>
            <li><strong>Name:</strong> ${customer.name}</li>
            <li><strong>Email:</strong> ${customer.email}</li>
            <li><strong>Company:</strong> ${customer.company || "N/A"}</li>
            <li><strong>ID:</strong> ${customer._id}</li>
          </ul>
        </div>
      </div>
    `;
    return this.sendEmail({ to: this.getAdminEmail(), subject: `[Admin Alert] New Buyer Registered: ${customer.name}`, html, category: "security" });
  },

  // 4. Order Confirmation Email
  async sendOrderConfirmationEmail(order: any, customerEmail: string): Promise<boolean> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
        <div style="background-color: #0f172a; padding: 20px; text-align: center;">
          <h2 style="color: #10b981; margin: 0;">Order Confirmation #${order._id}</h2>
        </div>
        <div style="padding: 24px; color: #334155;">
          <p>Hello <strong>${order.customerName}</strong>,</p>
          <p>Thank you for your order! We have received your wholesale purchase order <strong>#${order._id}</strong>.</p>
          <p>Total Amount: <strong>₹${Number(order.amount).toLocaleString("en-IN")}</strong></p>
          <p>Payment Method: <strong>${order.paymentMethod || "N/A"}</strong> | Payment Status: <strong>${order.paymentStatus || "Pending"}</strong></p>
        </div>
      </div>
    `;
    return this.sendEmail({ to: customerEmail, subject: `Order Confirmation #${order._id} - FlexSell Wholesale`, html, category: "orders" });
  },

  // 5. Admin New Order Alert Email
  async sendAdminNewOrderAlert(order: any): Promise<boolean> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
        <div style="background-color: #0f172a; padding: 20px; text-align: center;">
          <h2 style="color: #10b981; margin: 0;">New Order Received #${order._id}</h2>
        </div>
        <div style="padding: 24px; color: #334155;">
          <p>Hello Admin,</p>
          <p>A new wholesale purchase order has been placed:</p>
          <ul>
            <li><strong>Order ID:</strong> #${order._id}</li>
            <li><strong>Buyer:</strong> ${order.customerName}</li>
            <li><strong>Total Amount:</strong> ₹${Number(order.amount).toLocaleString("en-IN")}</li>
            <li><strong>Payment Status:</strong> ${order.paymentStatus}</li>
          </ul>
        </div>
      </div>
    `;
    return this.sendEmail({ to: this.getAdminEmail(), subject: `[Admin Alert] New Order #${order._id} Received`, html, category: "orders" });
  },

  // 6. Order Modification Summary Email
  async sendOrderModificationEmail(order: any, changesSummary: string): Promise<boolean> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
        <div style="background-color: #0f172a; padding: 20px; text-align: center;">
          <h2 style="color: #3b82f6; margin: 0;">Order Update #${order._id}</h2>
        </div>
        <div style="padding: 24px; color: #334155;">
          <p>Hello <strong>${order.customerName}</strong>,</p>
          <p>Your order <strong>#${order._id}</strong> has been updated by our fulfillment team.</p>
          <div style="background-color: #f1f5f9; padding: 16px; border-radius: 8px; font-size: 14px; margin: 16px 0;">
            <strong>Details of Changes:</strong>
            <p style="margin: 8px 0 0 0;">${changesSummary}</p>
          </div>
          <p>Updated Total: <strong>₹${Number(order.amount).toLocaleString("en-IN")}</strong></p>
        </div>
      </div>
    `;
    const email = order.shippingAddress?.email || order.customerEmail || "";
    return this.sendEmail({ to: email, subject: `Update regarding Order #${order._id}`, html, category: "orders" });
  },

  // 7. Shipment Tracking Email
  async sendShipmentNotificationEmail(order: any, courierName: string, trackingNumber: string, trackingUrl?: string): Promise<boolean> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
        <div style="background-color: #0f172a; padding: 20px; text-align: center;">
          <h2 style="color: #10b981; margin: 0;">Order Shipped #${order._id}</h2>
        </div>
        <div style="padding: 24px; color: #334155;">
          <p>Hello <strong>${order.customerName}</strong>,</p>
          <p>Great news! Your purchase order <strong>#${order._id}</strong> has been dispatched.</p>
          <p>Courier: <strong>${courierName}</strong> | Tracking ID: <strong>${trackingNumber}</strong></p>
          ${trackingUrl ? `<p><a href="${trackingUrl}" style="background-color: #10b981; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; display: inline-block;">Track Shipment</a></p>` : ""}
        </div>
      </div>
    `;
    const email = order.shippingAddress?.email || order.customerEmail || "";
    return this.sendEmail({ to: email, subject: `Shipment Dispatch Notice #${order._id}`, html, category: "shipments" });
  },

  // 8. Invoice / Proforma Quote Email
  async sendInvoiceQuoteEmail(invoice: any, customerEmail: string): Promise<boolean> {
    const typeLabel = invoice.type === "invoice" ? "GST Tax Invoice" : invoice.type === "receipt" ? "Payment Receipt" : "Proforma Quote";
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
        <div style="background-color: #0f172a; padding: 20px; text-align: center;">
          <h2 style="color: #6366f1; margin: 0;">${typeLabel} #${invoice._id}</h2>
        </div>
        <div style="padding: 24px; color: #334155;">
          <p>Hello <strong>${invoice.customerName}</strong>,</p>
          <p>Your ${typeLabel} <strong>#${invoice._id}</strong> has been issued.</p>
          <p>Amount: <strong>₹${Number(invoice.amount).toLocaleString("en-IN")}</strong></p>
        </div>
      </div>
    `;
    return this.sendEmail({ to: customerEmail, subject: `${typeLabel} #${invoice._id} Issued`, html, category: "invoices" });
  },

  // 9. Password Reset Email
  async sendPasswordResetEmail(email: string, resetLink: string): Promise<boolean> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
        <div style="background-color: #0f172a; padding: 20px; text-align: center;">
          <h2 style="color: #e11d48; margin: 0;">Password Reset Request</h2>
        </div>
        <div style="padding: 24px; color: #334155;">
          <p>Hello,</p>
          <p>We received a request to reset your password for your FlexSell Wholesale account. Click the link below to set a new password:</p>
          <p style="text-align: center; margin: 24px 0;">
            <a href="${resetLink}" style="background-color: #e11d48; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">Reset Password</a>
          </p>
          <p style="font-size: 12px; color: #64748b;">This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.</p>
        </div>
      </div>
    `;
    return this.sendEmail({ to: email, subject: "Reset Your FlexSell Wholesale Password", html, category: "security" });
  },

  // 10. Password Changed Notification
  async sendPasswordChangedEmail(email: string): Promise<boolean> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
        <div style="background-color: #0f172a; padding: 20px; text-align: center;">
          <h2 style="color: #10b981; margin: 0;">Password Changed Successfully</h2>
        </div>
        <div style="padding: 24px; color: #334155;">
          <p>Hello,</p>
          <p>Your FlexSell Wholesale account password has been successfully updated.</p>
          <p style="color: #b91c1c; font-weight: bold;">If you did not make this change, please contact our support team immediately.</p>
        </div>
      </div>
    `;
    return this.sendEmail({ to: email, subject: "Security Alert: Password Changed", html, category: "security" });
  },

  // 11. Profile Update Alert Email
  async sendProfileUpdatedEmail(email: string, name: string): Promise<boolean> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
        <div style="background-color: #0f172a; padding: 20px; text-align: center;">
          <h2 style="color: #10b981; margin: 0;">Profile Updated</h2>
        </div>
        <div style="padding: 24px; color: #334155;">
          <p>Hello <strong>${name}</strong>,</p>
          <p>This is to inform you that your FlexSell Wholesale account profile information was recently updated.</p>
          <p>If you did not perform this action, please contact security immediately.</p>
        </div>
      </div>
    `;
    return this.sendEmail({ to: email, subject: "Security Notification: Profile Updated", html, category: "security" });
  },

  // 12. Address Added/Modified Alert Email
  async sendAddressChangedEmail(email: string, name: string): Promise<boolean> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
        <div style="background-color: #0f172a; padding: 20px; text-align: center;">
          <h2 style="color: #10b981; margin: 0;">Shipping Addresses Updated</h2>
        </div>
        <div style="padding: 24px; color: #334155;">
          <p>Hello <strong>${name}</strong>,</p>
          <p>A shipping address was added, updated, or removed on your FlexSell Wholesale account.</p>
        </div>
      </div>
    `;
    return this.sendEmail({ to: email, subject: "Security Notification: Addresses Updated", html, category: "security" });
  },

  // 13. Payment Status Changed Email
  async sendPaymentStatusEmail(order: any, customerEmail: string): Promise<boolean> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
        <div style="background-color: #0f172a; padding: 20px; text-align: center;">
          <h2 style="color: #10b981; margin: 0;">Payment Status Update #${order._id}</h2>
        </div>
        <div style="padding: 24px; color: #334155;">
          <p>Hello <strong>${order.customerName}</strong>,</p>
          <p>The payment status for your order <strong>#${order._id}</strong> has been updated to: <strong>${order.paymentStatus}</strong>.</p>
          <p>Amount: <strong>₹${Number(order.amount).toLocaleString("en-IN")}</strong></p>
        </div>
      </div>
    `;
    return this.sendEmail({ to: customerEmail, subject: `Payment Status Update for Order #${order._id}`, html, category: "payments" });
  },

  // 14. Quote Response / Negotiation Email (Accepted/Rejected)
  async sendQuoteResponseNotification(quote: any, isAccepted: boolean): Promise<boolean> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
        <div style="background-color: #0f172a; padding: 20px; text-align: center;">
          <h2 style="color: #10b981; margin: 0;">Proforma Quote ${isAccepted ? "Accepted" : "Rejected"} #${quote._id}</h2>
        </div>
        <div style="padding: 24px; color: #334155;">
          <p>Hello Admin,</p>
          <p>Buyer <strong>${quote.customerName}</strong> has <strong>${isAccepted ? "ACCEPTED" : "REJECTED"}</strong> the proforma quote for order #${quote._id || quote.orderId}.</p>
          <p>Amount: <strong>₹${Number(quote.amount).toLocaleString("en-IN")}</strong></p>
        </div>
      </div>
    `;
    return this.sendEmail({ to: this.getAdminEmail(), subject: `[Quote Alert] Quote #${quote._id} ${isAccepted ? "Accepted" : "Rejected"}`, html, category: "quotes" });
  },

  // 15. Review Submitted Alert Email to Admin
  async sendAdminReviewAlert(review: any): Promise<boolean> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
        <div style="background-color: #0f172a; padding: 20px; text-align: center;">
          <h2 style="color: #eab308; margin: 0;">New Review Submitted</h2>
        </div>
        <div style="padding: 24px; color: #334155;">
          <p>Hello Admin,</p>
          <p>A new product review has been submitted and is pending moderation:</p>
          <ul>
            <li><strong>Product ID:</strong> ${review.productId}</li>
            <li><strong>Customer:</strong> ${review.customerName}</li>
            <li><strong>Rating:</strong> ${review.rating} / 5</li>
            <li><strong>Title:</strong> ${review.title}</li>
            <li><strong>Comment:</strong> ${review.comment}</li>
          </ul>
        </div>
      </div>
    `;
    return this.sendEmail({ to: this.getAdminEmail(), subject: `[Review Alert] Moderation Required for ${review.productId}`, html, category: "system" });
  },

  // 16. Review Moderated Notification to Customer
  async sendReviewModeratedEmail(review: any, customerEmail: string): Promise<boolean> {
    const isApproved = review.status === "Approved" || review.isApproved;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
        <div style="background-color: #0f172a; padding: 20px; text-align: center;">
          <h2 style="color: #10b981; margin: 0;">Product Review Moderated</h2>
        </div>
        <div style="padding: 24px; color: #334155;">
          <p>Hello <strong>${review.customerName}</strong>,</p>
          <p>Your product review has been reviewed by our moderation team and its status is now: <strong>${isApproved ? "Approved & Published" : "Rejected"}</strong>.</p>
          <div style="border-left: 4px solid #cbd5e1; padding-left: 12px; margin-top: 12px;">
            <p><strong>Rating:</strong> ${review.rating}/5</p>
            <p><em>"${review.comment}"</em></p>
          </div>
        </div>
      </div>
    `;
    return this.sendEmail({ to: customerEmail, subject: `Review Moderation Update: ${isApproved ? "Approved" : "Status Changed"}`, html, category: "system" });
  },

  // 17. RFQ/Inquiry Submitted Confirmation to Customer
  async sendCustomerInquiryConfirmation(inquiry: any, customerEmail: string): Promise<boolean> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
        <div style="background-color: #0f172a; padding: 20px; text-align: center;">
          <h2 style="color: #10b981; margin: 0;">Inquiry Received</h2>
        </div>
        <div style="padding: 24px; color: #334155;">
          <p>Hello <strong>${inquiry.customerName || "Valued Customer"}</strong>,</p>
          <p>Thank you for reaching out to FlexSell Wholesale. We have received your wholesale RFQ/inquiry:</p>
          <div style="background-color: #f8fafc; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <strong>Subject:</strong> ${inquiry.subject}<br/>
            <strong>Message:</strong><br/>
            ${inquiry.message}
          </div>
          <p>Our sales team will review your inquiry and get back to you within 24 business hours.</p>
        </div>
      </div>
    `;
    return this.sendEmail({ to: customerEmail, subject: `Inquiry Received - Reference #${inquiry._id || "RFQ"}`, html, category: "quotes" });
  },

  // 18. Admin New RFQ Alert Email
  async sendAdminInquiryAlert(inquiry: any): Promise<boolean> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
        <div style="background-color: #0f172a; padding: 20px; text-align: center;">
          <h2 style="color: #10b981; margin: 0;">New Wholesale Inquiry Received</h2>
        </div>
        <div style="padding: 24px; color: #334155;">
          <p>Hello Admin,</p>
          <p>A new wholesale RFQ/inquiry has been submitted:</p>
          <ul>
            <li><strong>Customer:</strong> ${inquiry.customerName} (${inquiry.email})</li>
            <li><strong>Subject:</strong> ${inquiry.subject}</li>
            <li><strong>Message:</strong> ${inquiry.message}</li>
          </ul>
        </div>
      </div>
    `;
    return this.sendEmail({ to: this.getAdminEmail(), subject: `[RFQ Inquiry Alert] ${inquiry.subject}`, html, category: "quotes" });
  },

  // 19. Inquiry Responded Email
  async sendInquiryResponseEmail(inquiry: any, responseText: string, customerEmail: string): Promise<boolean> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
        <div style="background-color: #0f172a; padding: 20px; text-align: center;">
          <h2 style="color: #10b981; margin: 0;">Inquiry Reply</h2>
        </div>
        <div style="padding: 24px; color: #334155;">
          <p>Hello <strong>${inquiry.customerName}</strong>,</p>
          <p>An administrator has replied to your wholesale inquiry (Subject: <em>"${inquiry.subject}"</em>):</p>
          <div style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 16px; margin: 16px 0; border-radius: 4px;">
            <strong>Reply:</strong><br/>
            ${responseText}
          </div>
        </div>
      </div>
    `;
    return this.sendEmail({ to: customerEmail, subject: `Reply regarding Inquiry: ${inquiry.subject}`, html, category: "quotes" });
  }
};
