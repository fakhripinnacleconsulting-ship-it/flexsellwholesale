import { NextResponse } from "next/server";
import { emailService } from "@/lib/emailService";
import { requireAuth } from "@/lib/authGuard";
import { rateLimit } from "@/lib/rateLimit";

/** Upper bound on recipients per request, so a single call cannot burn the sending quota. */
const MAX_RECIPIENTS = 500;

export async function POST(req: Request) {
  try {
    // This endpoint reaches the mail transport with caller-supplied HTML and recipients —
    // without an admin session it is an open relay for anyone who knows the URL.
    const auth = await requireAuth("admin");
    if (auth.error) return auth.error;

    try {
      await rateLimit(auth.payload!.userId, "general");
    } catch {
      return NextResponse.json({ message: "Too many requests. Please try again later." }, { status: 429 });
    }

    const body = await req.json();
    const { emails, subject, html } = body;

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json({ message: "No recipient emails provided." }, { status: 400 });
    }

    if (emails.length > MAX_RECIPIENTS) {
      return NextResponse.json(
        { message: `Too many recipients (${emails.length}). Maximum ${MAX_RECIPIENTS} per send.` },
        { status: 400 }
      );
    }

    if (!subject || !html) {
      return NextResponse.json({ message: "Subject and HTML content are required." }, { status: 400 });
    }

    // Join emails with comma for the "bcc:" field to hide recipient addresses
    const bccList = emails.join(", ");

    const success = await emailService.sendEmail({
      to: "noreply@flexsellwholesale.com",
      bcc: bccList,
      subject,
      html,
      category: "bulk-admin",
    });

    if (success) {
      return NextResponse.json({ success: true, message: `Email sent to ${emails.length} recipients.` });
    } else {
      return NextResponse.json({ message: "Failed to send email. Check server logs." }, { status: 500 });
    }
  } catch (error: any) {
    console.error("Bulk email error:", error);
    return NextResponse.json(
      { message: error.message || "Internal server error during bulk email dispatch" },
      { status: 500 }
    );
  }
}
