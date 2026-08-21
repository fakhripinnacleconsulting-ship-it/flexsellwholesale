import { formatDateTimeIST } from "@/lib/datetime";
import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import InvoiceModel from "@/models/Invoice";
import Order from "@/models/Order";
import Manager from "@/models/Manager";
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

    if (payload.role !== "admin" && payload.role !== "manager") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;
    await dbConnect();

    const existingDoc = await InvoiceModel.findById(id) as any;
    if (!existingDoc) {
      return NextResponse.json({ message: "Document not found" }, { status: 404 });
    }

    if (payload.role === "manager") {
      let perms = (payload as any).permissions || [];
      if (payload.userId && /^[0-9a-fA-F]{24}$/.test(payload.userId)) {
        const managerDoc = await Manager.findById(payload.userId).lean() as any;
        if (managerDoc && managerDoc.permissions) {
          perms = managerDoc.permissions;
        }
      }
      // Exact match on the action being performed. The `startsWith(`${permKey}:`)` clause
      // this replaces meant `invoices_invoice:read` satisfied an update check — a read-only
      // manager could edit and delete every document they were allowed to look at.
      const permKey = `invoices_${existingDoc.type}`;
      const hasPerm = perms.includes(permKey) || perms.includes(`${permKey}:update`);
      if (!hasPerm) {
        return NextResponse.json({ message: "Forbidden: Insufficient permissions to update document" }, { status: 403 });
      }
    }

    const body = await request.json();

    /**
     * 0. PAYMENT SETTLEMENT IS NOT AN UPDATE.
     *
     * This route used to accept `{ paymentStatus: "Paid", paymentMethod: "Store Advance Balance" }` and
     * write it straight through — no balance read, no debit, no ledger entry. A customer with
     * ₹0 could have a receipt marked Paid and converted to a Tax Invoice.
     *
     * Settlement now belongs to POST /api/invoices/[id]/settle, which is the only code that
     * may both move money and mint an invoice number. Anything arriving here that tries to
     * settle is refused rather than quietly ignored, so a stale client fails loudly.
     */
    if (body.paymentStatus !== undefined || body.paymentMethod !== undefined || body.transactionId !== undefined) {
      return NextResponse.json(
        {
          message:
            "Payment details cannot be set through this endpoint. Use the payment action so the amount is actually collected.",
          code: "USE_SETTLE_ENDPOINT",
        },
        { status: 400 }
      );
    }

    if (existingDoc.type === "receipt" && body.status === "paid") {
      return NextResponse.json(
        {
          message: "A receipt is marked paid by recording a payment, not by editing its status.",
          code: "USE_SETTLE_ENDPOINT",
        },
        { status: 400 }
      );
    }

    /**
     * A settled receipt is frozen.
     *
     * It is retained as the record of a payment that a live `INV-` Tax Invoice was issued
     * against, so voiding or re-editing it would contradict a document that cannot itself be
     * edited. Cancel the sale by voiding the Tax Invoice, not the evidence behind it.
     */
    if (
      existingDoc.type === "receipt" &&
      (existingDoc.settledByInvoiceId || existingDoc.status === "paid") &&
      !(Object.keys(body).length === 1 && body.isArchived !== undefined)
    ) {
      return NextResponse.json(
        {
          message: `This receipt was settled${existingDoc.settledByInvoiceId ? ` by Tax Invoice ${existingDoc.settledByInvoiceId}` : ""} and can no longer be changed. Void the Tax Invoice instead.`,
        },
        { status: 400 }
      );
    }

    /**
     * 1. INVOICE IMMUTABILITY RULES
     *
     * An allowlist, not a blocklist. The blocklist this replaces named nine fields and so
     * left `customerGstin`, `sellerInfo`, `generatedAt` and `customerType` editable on an
     * issued tax invoice — and would have silently exposed every field added to the schema
     * afterwards. An allowlist fails closed instead.
     */
    if (existingDoc.type === "invoice") {
      const INVOICE_MUTABLE_FIELDS = ["notes", "isArchived", "status"];
      const attempted = Object.keys(body).filter((field) => !INVOICE_MUTABLE_FIELDS.includes(field));
      if (attempted.length > 0) {
        return NextResponse.json(
          { message: `Invoice details cannot be modified once generated (${attempted.join(", ")}).` },
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

    /**
     * 3. STANDARD DOCUMENT UPDATE
     *
     * The in-place receipt-to-invoice conversion that used to live here has moved to
     * POST /api/invoices/[id]/settle. It mutated `type` on the existing document, and since
     * `_id` is an assigned String that MongoDB will not change, every "Tax Invoice" it
     * produced kept its `REC-` number and the `INV-` counter never advanced — a GST Rule
     * 46(b) violation. Settlement now issues a real, separate INV- document.
     */
    const allowedFields = [
      "status", "notes", "items", "amount", "taxDetails",
      "shippingAddress", "customerName", "customerGstin",
      "salesperson", "isArchived"
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

    if (payload.role !== "admin" && payload.role !== "manager") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;
    await dbConnect();

    const invoice = await InvoiceModel.findById(id).lean() as any;
    if (!invoice) {
      return NextResponse.json({ message: "Document not found" }, { status: 404 });
    }

    if (payload.role === "manager") {
      let perms = (payload as any).permissions || [];
      if (payload.userId && /^[0-9a-fA-F]{24}$/.test(payload.userId)) {
        const managerDoc = await Manager.findById(payload.userId).lean() as any;
        if (managerDoc && managerDoc.permissions) {
          perms = managerDoc.permissions;
        }
      }
      // Exact match — see the equivalent note on the update path above.
      const permKey = `invoices_${invoice.type}`;
      const hasPerm = perms.includes(permKey) || perms.includes(`${permKey}:delete`);
      if (!hasPerm) {
        return NextResponse.json({ message: "Forbidden: Insufficient permissions to delete document" }, { status: 403 });
      }
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

    /**
     * 3. A SETTLED RECEIPT CANNOT BE DELETED
     *
     * Settlement stopped mutating the receipt into the invoice and started issuing a separate
     * `INV-` that points back at it, which means the receipt now survives — as the record of
     * what was actually collected. Deleting it would strip the audit trail from a live Tax
     * Invoice and orphan the `sourceReceiptId` that makes double-settlement impossible.
     *
     * Only settled receipts are protected; an unpaid one is still just a draft demand.
     */
    if (invoice.type === "receipt" && (invoice.settledByInvoiceId || invoice.status === "paid")) {
      return NextResponse.json(
        {
          message: `This receipt was settled${invoice.settledByInvoiceId ? ` by Tax Invoice ${invoice.settledByInvoiceId}` : ""} and is the record of that payment, so it cannot be deleted.`,
        },
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
              timestamp: formatDateTimeIST(new Date()),
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
