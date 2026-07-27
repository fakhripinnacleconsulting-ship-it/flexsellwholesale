import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Inquiry from "@/models/Inquiry";
import Notification from "@/models/Notification";
import { emailService } from "@/lib/emailService";
import { dispatchEvent } from "@/lib/events/eventDispatcher";
import { verifyToken, getTokenFromCookie } from "@/lib/auth";

export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const status = searchParams.get("status");
    const search = searchParams.get("search");

    const query: any = {};
    if (category && category !== "all") {
      query.category = category;
    }
    if (status && status !== "all") {
      query.status = status;
    }
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { company: { $regex: search, $options: "i" } },
        { subject: { $regex: search, $options: "i" } },
        { message: { $regex: search, $options: "i" } }
      ];
    }

    const inquiries = await Inquiry.find(query).sort({ createdAt: -1 });
    return NextResponse.json(inquiries);
  } catch (error: unknown) {
    return NextResponse.json({ message: (error as any).message || "Failed to fetch inquiries" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await dbConnect();
    const body = await request.json();

    const { firstName, lastName, email, subject, message } = body;
    if (!firstName || !lastName || !email || !subject || !message) {
      return NextResponse.json({ message: "Missing required fields" }, { status: 400 });
    }

    const newInquiry = await Inquiry.create({
      category: body.category || "general",
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
      phone: body.phone || "",
      company: body.company || "",
      subject: body.subject,
      message: body.message,
      expectedOrders: body.expectedOrders || "",
      productInterests: body.productInterests || [],
      status: "new"
    });

    const customerName = `${newInquiry.firstName} ${newInquiry.lastName}`.trim();

    // 1. Create In-App Notification document for Admin in MongoDB
    try {
      await Notification.create({
        customerId: "admin",
        recipientRole: "admin",
        title: `New ${body.category === "dropshipping" ? "Dropshipping" : "Wholesale"} Inquiry: ${newInquiry.subject}`,
        message: `${customerName} (${newInquiry.email}) submitted: "${newInquiry.subject}".`,
        type: "info",
        isRead: false,
        link: "/admin/inquiries",
        actionType: "INQUIRY_SUBMITTED",
        entityId: newInquiry._id.toString()
      });
    } catch (notifErr) {
      console.error("[INQUIRY NOTIFICATION ERROR] Failed to create admin notification:", notifErr);
    }

    // 2. Dispatch SMTP Email Alert to Admin
    try {
      await emailService.sendAdminInquiryAlert({
        customerName,
        email: newInquiry.email,
        subject: newInquiry.subject,
        message: newInquiry.message,
        _id: newInquiry._id.toString()
      });
    } catch (mailErr) {
      console.error("[INQUIRY EMAIL ERROR] Admin email alert failed:", mailErr);
    }

    // 3. Dispatch SMTP Confirmation Email to Customer/Applicant
    try {
      await emailService.sendCustomerInquiryConfirmation(
        {
          customerName,
          subject: newInquiry.subject,
          message: newInquiry.message,
          _id: newInquiry._id.toString()
        },
        newInquiry.email
      );
    } catch (mailErr) {
      console.error("[INQUIRY EMAIL ERROR] Customer confirmation email failed:", mailErr);
    }

    // 4. Dispatch System Event for Push & Client Notifications
    try {
      dispatchEvent({
        eventType: "INQUIRY_SUBMITTED",
        category: "quotes",
        actor: {
          id: newInquiry._id.toString(),
          name: customerName,
          role: "customer"
        },
        recipient: {
          role: "both",
          email: newInquiry.email,
          name: customerName
        },
        entity: {
          type: "inquiry",
          id: newInquiry._id.toString()
        },
        data: {
          subject: newInquiry.subject,
          message: newInquiry.message,
          email: newInquiry.email,
          customerName,
          company: newInquiry.company
        }
      });
    } catch (evtErr) {
      console.error("[INQUIRY EVENT ERROR] Failed to dispatch system event:", evtErr);
    }

    return NextResponse.json({ message: "Inquiry submitted successfully", inquiry: newInquiry }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json({ message: (error as any).message || "Failed to submit inquiry" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
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

    const body = await request.json();
    const { id, status, adminNotes } = body;

    if (!id) {
      return NextResponse.json({ message: "Inquiry ID is required" }, { status: 400 });
    }

    const updateFields: any = {};
    if (status) updateFields.status = status;
    if (adminNotes !== undefined) updateFields.adminNotes = adminNotes;

    const updated = await Inquiry.findByIdAndUpdate(id, updateFields, { new: true });
    if (!updated) {
      return NextResponse.json({ message: "Inquiry not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error: unknown) {
    return NextResponse.json({ message: (error as any).message || "Failed to update inquiry" }, { status: 500 });
  }
}
