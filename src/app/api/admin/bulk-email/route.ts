import { NextResponse } from "next/server";
import { emailService } from "@/lib/emailService";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { emails, subject, html } = body;

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json({ message: "No recipient emails provided." }, { status: 400 });
    }

    if (!subject || !html) {
      return NextResponse.json({ message: "Subject and HTML content are required." }, { status: 400 });
    }

    // Join emails with comma for the "To:" field
    const to = emails.join(", ");

    const success = await emailService.sendEmail({
      to,
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
