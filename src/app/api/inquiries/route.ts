import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Inquiry from "@/models/Inquiry";
import Notification from "@/models/Notification";
import Manager from "@/models/Manager";
import { emailService } from "@/lib/emailService";
import { dispatchEventServer } from "@/lib/events/eventDispatcherServer";
import { verifyToken, getTokenFromCookie } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";

export async function GET(request: Request) {
  try {
    await dbConnect();
    const token = await getTokenFromCookie();
    if (!token) {
      return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ message: "Invalid session" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const status = searchParams.get("status");
    const search = searchParams.get("search");

    const query: Record<string, unknown> = {};

    // A customer sees only the tickets they filed. This route used to be admin-only,
    // which meant /client/support always got a 403 and showed an empty ticket list.
    if (payload.role !== "admin" && payload.role !== "manager") {
      query.email = payload.email.toLowerCase();
    } else {
      if (payload.role === "manager") {
        let perms = (payload as any).permissions || [];
        const managerUser = await Manager.findById(payload.userId).lean();
        if (managerUser) {
          perms = managerUser.permissions || [];
        }
        
        const allowedCategories = [];
        if (perms.includes("inquiries_wholesale") || perms.includes("inquiries_wholesale:read")) allowedCategories.push("wholesale");
        if (perms.includes("inquiries_dropshipping") || perms.includes("inquiries_dropshipping:read")) allowedCategories.push("dropshipping");
        if (perms.includes("inquiries_support") || perms.includes("inquiries_support:read")) allowedCategories.push("support");
        if (perms.includes("inquiries_franchise") || perms.includes("inquiries_franchise:read")) allowedCategories.push("franchise");
        if (perms.includes("inquiries_general") || perms.includes("inquiries_general:read")) allowedCategories.push("general");
        
        if (allowedCategories.length === 0) {
          return NextResponse.json({ message: "Forbidden: No inquiry access" }, { status: 403 });
        }
        
        if (category && category !== "all") {
          if (!allowedCategories.includes(category)) {
            return NextResponse.json({ message: "Forbidden category" }, { status: 403 });
          }
          query.category = category;
        } else {
          query.category = { $in: allowedCategories };
        }
      } else {
        if (category && category !== "all") {
          query.category = category;
        }
      }
      
      if (status && status !== "all") {
        query.status = status;
      }
      if (search) {
        // Escape regex metacharacters so a search string cannot alter the query shape.
        const safe = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        query.$or = [
          { firstName: { $regex: safe, $options: "i" } },
          { lastName: { $regex: safe, $options: "i" } },
          { email: { $regex: safe, $options: "i" } },
          { company: { $regex: safe, $options: "i" } },
          { subject: { $regex: safe, $options: "i" } },
          { message: { $regex: safe, $options: "i" } }
        ];
      }
    }

    const inquiries = await Inquiry.find(query).sort({ createdAt: -1 });
    return NextResponse.json(inquiries);
  } catch (error: unknown) {
    return NextResponse.json({ message: (error as any).message || "Failed to fetch inquiries" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    // Public endpoint that emails the admin on every submission — rate-limit per IP so it
    // cannot be used to flood the support inbox.
    const forwardedFor = request.headers.get("x-forwarded-for");
    const ip = forwardedFor ? forwardedFor.split(",")[0].trim() : "unknown";
    try {
      await rateLimit(ip, "general");
    } catch {
      return NextResponse.json(
        { message: "Too many submissions. Please try again in a minute." },
        { status: 429 }
      );
    }

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

    // Dispatch System Event (Rule 7: Admin Notif = TRUE, Admin Mail = TRUE via centralized eventHandler)
    try {
      dispatchEventServer({
        eventType: "INQUIRY_SUBMITTED",
        category: "quotes",
        actor: {
          id: newInquiry._id.toString(),
          name: customerName,
          role: "customer"
        },
        recipient: {
          role: "admin",
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
    if (!payload || (payload.role !== "admin" && payload.role !== "manager")) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { id, status, adminNotes } = body;

    if (!id) {
      return NextResponse.json({ message: "Inquiry ID is required" }, { status: 400 });
    }

    const existing = await Inquiry.findById(id);
    if (!existing) {
      return NextResponse.json({ message: "Inquiry not found" }, { status: 404 });
    }

    if (payload.role === "manager") {
      const perms = (payload as any).permissions || [];
      const cat = existing.category;
      if (
        (cat === "wholesale" && !perms.includes("inquiries_wholesale")) ||
        (cat === "dropshipping" && !perms.includes("inquiries_dropshipping")) ||
        (cat === "support" && !perms.includes("inquiries_support")) ||
        (cat === "franchise" && !perms.includes("inquiries_franchise")) ||
        (cat === "general" && !perms.includes("inquiries_general"))
      ) {
        return NextResponse.json({ message: "Forbidden: Cannot edit this inquiry" }, { status: 403 });
      }
    }

    const previousNotes = existing.adminNotes || "";

    const updateFields: Record<string, unknown> = {};
    if (status) updateFields.status = status;
    if (adminNotes !== undefined) updateFields.adminNotes = adminNotes;

    const updated = await Inquiry.findByIdAndUpdate(id, updateFields, { new: true });
    if (!updated) {
      return NextResponse.json({ message: "Inquiry not found" }, { status: 404 });
    }

    // Notify the customer when an admin actually writes a reply. Gated on the text having
    // changed so a plain status update doesn't re-send the same email.
    const replyText = (adminNotes || "").trim();
    if (replyText && replyText !== previousNotes.trim()) {
      try {
        const customerName = `${updated.firstName} ${updated.lastName}`.trim();
        dispatchEventServer({
          eventType: "INQUIRY_RESPONDED",
          category: "quotes",
          actor: { id: payload.userId, name: "Support Team", role: "admin" },
          recipient: { email: updated.email, name: customerName, role: "customer" },
          entity: { type: "inquiry", id: String(updated._id) },
          data: {
            subject: updated.subject,
            responseText: replyText,
            customerName,
            email: updated.email,
          },
        });
      } catch (err) {
        console.error("[INQUIRY EVENT ERROR] Failed to dispatch INQUIRY_RESPONDED:", err);
      }
    }

    return NextResponse.json(updated);
  } catch (error: unknown) {
    return NextResponse.json({ message: (error as any).message || "Failed to update inquiry" }, { status: 500 });
  }
}

