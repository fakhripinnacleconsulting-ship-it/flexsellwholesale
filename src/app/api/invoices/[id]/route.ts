import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import InvoiceModel from "@/models/Invoice";
import Order from "@/models/Order";
import { requireAuth } from "@/lib/authGuard";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const { id } = await params;
    await dbConnect();

    const invoice = await InvoiceModel.findById(id).lean() as any;
    if (!invoice) {
      return NextResponse.json({ message: "Invoice not found" }, { status: 404 });
    }

    // Non-admin users can only view their own invoices
    const payload = auth.payload!;
    if (payload.role !== "admin" && invoice.customerEmail !== payload.email.toLowerCase()) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }

    return NextResponse.json(invoice);
  } catch (error: any) {
    return NextResponse.json(
      { message: error.message || "Failed to fetch invoice" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;
    const payload = auth.payload!;

    if (payload.role !== "admin") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;
    await dbConnect();

    const existingDoc = await InvoiceModel.findById(id) as any;
    if (!existingDoc) {
      return NextResponse.json({ message: "Document not found" }, { status: 404 });
    }

    const body = await request.json();

    // 1. INVOICE IMMUTABILITY RULES
    if (existingDoc.type === "invoice") {
      const blockedFields = [
        "items", "amount", "customerName", "customerEmail", 
        "taxDetails", "shippingAddress", "paymentMethod", 
        "paymentStatus", "transactionId"
      ];
      if (blockedFields.some(field => body[field] !== undefined)) {
        return NextResponse.json(
          { message: "Invoice details cannot be modified once generated." }, 
          { status: 400 }
        );
      }
      if (body.status !== undefined && !["paid", "void", "archived"].includes(body.status)) {
        return NextResponse.json(
          { message: "Invalid status transition for invoices." }, 
          { status: 400 }
        );
      }
    }

    // 2. CONVERTED QUOTE LOCKING RULES
    if (existingDoc.type === "quote" && existingDoc.status === "converted") {
      return NextResponse.json(
        { message: "Converted quotes cannot be modified." }, 
        { status: 400 }
      );
    }

    // 3. SAFE & IDEMPOTENT RECEIPT TO INVOICE CONVERSION
    if (existingDoc.type === "receipt" && (body.status === "paid" || body.paymentStatus === "Paid")) {
      if (existingDoc.orderId) {
        const duplicateInvoice = await InvoiceModel.findOne({
          orderId: existingDoc.orderId,
          type: "invoice"
        }).lean();
        if (duplicateInvoice) {
          return NextResponse.json(
            { message: "An invoice has already been generated for this order." }, 
            { status: 400 }
          );
        }
      }

      let orderBackup: any = null;
      const docBackup = {
        type: existingDoc.type,
        status: existingDoc.status,
        paymentStatus: existingDoc.paymentStatus,
        paymentMethod: existingDoc.paymentMethod,
        transactionId: existingDoc.transactionId
      };

      try {
        if (existingDoc.orderId) {
          const linkedOrder = await Order.findById(existingDoc.orderId);
          if (linkedOrder) {
            orderBackup = {
              paymentStatus: linkedOrder.paymentStatus,
              paymentMethod: linkedOrder.paymentMethod,
              transactionId: linkedOrder.transactionId
            };
            await Order.findByIdAndUpdate(existingDoc.orderId, {
              paymentStatus: "Paid",
              paymentMethod: body.paymentMethod || existingDoc.paymentMethod || "Bank Transfer",
              transactionId: body.transactionId || existingDoc.transactionId || ""
            });
          }
        }

        const updated = await InvoiceModel.findByIdAndUpdate(
          id,
          {
            $set: {
              type: "invoice",
              status: "paid",
              paymentStatus: "Paid",
              paymentMethod: body.paymentMethod || existingDoc.paymentMethod || "Bank Transfer",
              transactionId: body.transactionId || existingDoc.transactionId || "",
              notes: body.notes !== undefined ? body.notes : existingDoc.notes
            }
          },
          { new: true, runValidators: true }
        ).lean();

        return NextResponse.json(updated);
      } catch (err: any) {
        // Rollback Order state
        if (existingDoc.orderId && orderBackup) {
          await Order.findByIdAndUpdate(existingDoc.orderId, orderBackup);
        }
        // Rollback Receipt document state
        await InvoiceModel.findByIdAndUpdate(id, { $set: docBackup });
        throw err;
      }
    }

    // 4. STANDARD DOCUMENT UPDATE
    const allowedFields = [
      "status", "notes", "items", "amount", "taxDetails",
      "shippingAddress", "paymentStatus", "customerName", "customerGstin",
      "paymentMethod", "transactionId", "salesperson", "isArchived"
    ];

    const updateData: Record<string, any> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    const updated = await InvoiceModel.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).lean();

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json(
      { message: error.message || "Failed to update document" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;
    const payload = auth.payload!;

    if (payload.role !== "admin") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;
    await dbConnect();

    const invoice = await InvoiceModel.findById(id).lean() as any;
    if (!invoice) {
      return NextResponse.json({ message: "Document not found" }, { status: 404 });
    }

    // 1. INVOICES CANNOT BE DELETED
    if (invoice.type === "invoice") {
      return NextResponse.json(
        { message: "Invoices cannot be permanently deleted. You can archive them instead." }, 
        { status: 400 }
      );
    }

    // 2. CONVERTED QUOTES CANNOT BE DELETED
    if (invoice.type === "quote" && invoice.status === "converted") {
      return NextResponse.json(
        { message: "Converted quotes cannot be deleted." }, 
        { status: 400 }
      );
    }

    // 3. LOG DELETIONS FOR AUDIT
    if (invoice.type === "receipt" && invoice.orderId) {
      await Order.findByIdAndUpdate(invoice.orderId, {
        $push: {
          history: {
            $each: [{
              status: "Receipt Deleted",
              timestamp: new Date().toLocaleString("en-IN"),
              description: `Receipt ${id} was deleted by Admin. Payment status remains Pending.`
            }],
            $position: 0
          }
        }
      });
    }

    // Remove invoiceId reference from linked order
    if (invoice.orderId) {
      await Order.findByIdAndUpdate(invoice.orderId, { $unset: { invoiceId: "" } });
    }

    await InvoiceModel.findByIdAndDelete(id);

    console.log(`[AUDIT] Deleted ${invoice.type} ${id} by Admin ID ${payload.userId}`);

    return NextResponse.json({ message: "Document deleted successfully" });
  } catch (error: any) {
    return NextResponse.json(
      { message: error.message || "Failed to delete document" },
      { status: 500 }
    );
  }
}
