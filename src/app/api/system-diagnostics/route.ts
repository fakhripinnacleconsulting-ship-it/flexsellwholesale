import { NextResponse } from "next/server";
import mongoose from "mongoose";
import nodemailer from "nodemailer";
import { getShiprocketToken } from "@/lib/shiprocketClient";
import { emailService } from "@/lib/emailService";
import { dispatchEventServer } from "@/lib/events/eventDispatcherServer";
import { requireAuth } from "@/lib/authGuard";

export const dynamic = "force-dynamic";

function maskSecret(val?: string, visibleChars = 8): string {
  if (!val) return "NOT CONFIGURED ❌";
  if (val.length <= visibleChars) return `${val.substring(0, 3)}***`;
  return `${val.substring(0, visibleChars)}...***`;
}

export async function GET() {
  const auth = await requireAuth("admin");
  if (auth.error) return auth.error;

  const timestamp = new Date().toISOString();
  const environment = process.env.NODE_ENV || "production";

  // 1. MongoDB Connection Test
  let mongodbResult = {
    status: "FAILED ❌",
    latencyMs: 0,
    databaseName: "Unknown",
    uriConfigured: !!process.env.MONGODB_URI,
    maskedUri: maskSecret(process.env.MONGODB_URI, 28),
    collections: [] as Array<{ name: string; count: number }>,
    adminUserFound: false,
    adminEmail: null as string | null,
    error: null as string | null
  };

  const mongoStart = Date.now();
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error("MONGODB_URI environment variable is missing on Vercel!");
    }

    const conn = await mongoose.createConnection(mongoUri).asPromise();
    mongodbResult.latencyMs = Date.now() - mongoStart;
    mongodbResult.status = "CONNECTED ✅";

    if (!conn.db) {
      throw new Error("MongoDB connection established, but database object is undefined.");
    }
    const db = conn.db;

    mongodbResult.databaseName = db.databaseName;

    const collections = await db.listCollections().toArray();
    for (const col of collections) {
      const count = await db.collection(col.name).countDocuments();
      mongodbResult.collections.push({ name: col.name, count });
    }

    const adminUser = await db.collection("customers").findOne({ role: "admin" });
    if (adminUser) {
      mongodbResult.adminUserFound = true;
      mongodbResult.adminEmail = adminUser.email;
    }

    await conn.close();
  } catch (err: any) {
    mongodbResult.status = "FAILED ❌";
    mongodbResult.error = err.message || "Failed to connect to MongoDB Atlas";
  }

  // 2. Email Service Test (ZeptoMail / Gmail)
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL || "").toLowerCase();
  const isZeptoDomain = siteUrl.includes("flexsellwholesale.com") || siteUrl.includes("flexsellwholesale.vercel.app") || process.env.SMTP_HOST?.includes("zeptomail");

  const expectedHost = process.env.SMTP_HOST || (isZeptoDomain ? "smtp.zeptomail.in" : "smtp.gmail.com");
  const expectedPort = parseInt(process.env.SMTP_PORT || "465", 10);
  const expectedUser = process.env.SMTP_USER || (isZeptoDomain ? "emailapikey" : "mauryatech7@gmail.com");
  const expectedFrom = process.env.SMTP_FROM || (isZeptoDomain ? `"FlexSell Wholesale Support" <noreply@flexsellwholesale.com>` : `"FlexSell Wholesale Support" <mauryatech7@gmail.com>`);

  let emailResult = {
    status: "FAILED ❌",
    provider: isZeptoDomain ? "ZeptoMail SMTP" : "Gmail SMTP",
    host: expectedHost,
    port: expectedPort,
    user: expectedUser,
    from: expectedFrom,
    connectionVerified: false,
    error: null as string | null
  };

  try {
    if (!process.env.SMTP_PASS) {
      throw new Error("SMTP_PASS environment variable is not configured.");
    }
    const transporter = nodemailer.createTransport({
      host: expectedHost,
      port: expectedPort,
      secure: expectedPort === 465,
      auth: {
        user: expectedUser,
        pass: process.env.SMTP_PASS
      },
      tls: { rejectUnauthorized: false }
    });

    await transporter.verify();
    emailResult.connectionVerified = true;
    emailResult.status = "ACTIVE ✅";
  } catch (err: any) {
    emailResult.status = "FAILED ❌";
    emailResult.error = err.message || "Failed to verify SMTP credentials";
  }

  // 3. Shiprocket API Service Test
  let shiprocketResult = {
    status: "NOT CONFIGURED ⚠️",
    emailConfigured: !!(process.env.SHIPROCKET_EMAIL),
    maskedEmail: maskSecret(process.env.SHIPROCKET_EMAIL, 12),
    tokenAcquired: false,
    error: null as string | null
  };

  try {
    const token = await getShiprocketToken(false);
    if (token) {
      shiprocketResult.tokenAcquired = true;
      shiprocketResult.status = "CONNECTED ✅";
    }
  } catch (err: any) {
    if (process.env.SHIPROCKET_EMAIL) {
      shiprocketResult.status = "FAILED ❌";
      shiprocketResult.error = err.message || "Shiprocket auth failed";
    }
  }

  // 4. Integrations & Environment Variables Summary
  const envSummary = {
    MONGODB_URI: maskSecret(process.env.MONGODB_URI, 28),
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || "NOT SET",
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || "/api",
    SMTP_HOST: process.env.SMTP_HOST || (isZeptoDomain ? "smtp.zeptomail.in (Default)" : "smtp.gmail.com (Default)"),
    SMTP_USER: process.env.SMTP_USER || (isZeptoDomain ? "emailapikey (Default)" : "mauryatech7@gmail.com (Default)"),
    RAZORPAY_KEY_ID: maskSecret(process.env.RAZORPAY_KEY_ID, 12),
    RAZORPAY_KEY_SECRET: maskSecret(process.env.RAZORPAY_KEY_SECRET, 8),
    UPSTASH_REDIS_REST_URL: maskSecret(process.env.UPSTASH_REDIS_REST_URL, 20),
    BLOB_STORE_ID: process.env.BLOB_STORE_ID || "NOT CONFIGURED ❌",
    BLOB_READ_WRITE_TOKEN: maskSecret(process.env.BLOB_READ_WRITE_TOKEN, 16),
  };

  return NextResponse.json({
    timestamp,
    environment,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
    mongodb: mongodbResult,
    email: emailResult,
    shiprocket: shiprocketResult,
    envSummary
  });
}

// POST endpoint to send a test email from the diagnostics page
export async function POST(req: Request) {
  const auth = await requireAuth("admin");
  if (auth.error) return auth.error;

  try {
    const body = await req.json();
    const { testEmail } = body;

    if (!testEmail || !testEmail.includes("@")) {
      return NextResponse.json({ message: "Please provide a valid test recipient email address." }, { status: 400 });
    }

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #10b981; border-radius: 12px; background-color: #ffffff;">
        <div style="background-color: #0f172a; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h2 style="color: #10b981; margin: 0;">FlexSell Wholesale System Diagnostics</h2>
          <p style="color: #94a3b8; margin: 4px 0 0 0; font-size: 12px;">Live Production SMTP Test</p>
        </div>
        <div style="padding: 24px; color: #334155;">
          <p style="font-size: 16px;">Hello,</p>
          <p>This is a live test email sent from the <strong>FlexSell Wholesale System Diagnostics Hub</strong>.</p>
          <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 16px; margin: 16px 0; border-radius: 4px; font-size: 13px;">
            <strong>Test Dispatch Details:</strong><br/>
            - Dispatched At: ${new Date().toLocaleString("en-IN")}<br/>
            - Recipient: ${testEmail}<br/>
            - Environment: ${process.env.NODE_ENV || "production"}<br/>
            - Connection: Verified Vercel SMTP Credentials
          </div>
          <p style="font-size: 12px; color: #64748b;">If you received this email, your Vercel SMTP mail dispatch system is 100% operational.</p>
        </div>
      </div>
    `;

    const success = await emailService.sendEmail({
      to: testEmail,
      subject: "✅ Production System Test Email — FlexSell Wholesale",
      html,
      category: "security"
    });

    if (!success) {
      return NextResponse.json({ message: "Email dispatch failed. Please check server logs." }, { status: 500 });
    }

    // Trigger test event notification
    dispatchEventServer({
      eventType: "DIAGNOSTIC_TEST",
      category: "system",
      actor: { id: "SYSTEM", name: "System Diagnostics", role: "admin" },
      recipient: { email: testEmail, name: "Admin Tester", role: "admin" },
      entity: { type: "system", id: "diag-001" },
      data: { testEmail, dispatchedAt: new Date().toISOString() }
    });

    return NextResponse.json({
      message: `Test email dispatched successfully to ${testEmail}!`
    });
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "Failed to dispatch test email" }, { status: 500 });
  }
}

