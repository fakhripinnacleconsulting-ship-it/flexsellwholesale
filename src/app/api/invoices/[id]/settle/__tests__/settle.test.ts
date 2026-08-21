import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The regression suite for the two bugs this endpoint exists to fix.
 *
 * Both shipped while 293 tests passed, because the Advance Balance *engine* was covered and its
 * *callers* were not. These tests exercise the caller.
 */

vi.mock("@/lib/dbConnect", () => ({ default: vi.fn().mockResolvedValue(true) }));

vi.mock("@/lib/rateLimit", () => ({ rateLimit: vi.fn().mockResolvedValue(true) }));

vi.mock("@/lib/authGuard", () => ({
  requireAuth: vi.fn().mockResolvedValue({ payload: { userId: "ADM-1", email: "a@f.com", role: "admin" } }),
}));

const mockSpendAccess = vi.fn();
vi.mock("@/lib/advanceBalanceGuard", () => ({
  requireAdvanceBalanceSpendAccess: (...a: any[]) => mockSpendAccess(...a),
}));

const mockReserve = vi.fn();
const mockCapture = vi.fn();
const mockRefund = vi.fn();
vi.mock("@/lib/advanceBalanceCheckout", () => ({
  reserveAdvanceBalanceFunds: (...a: any[]) => mockReserve(...a),
  captureAdvanceBalanceFunds: (...a: any[]) => mockCapture(...a),
  refundAdvanceBalanceOrder: (...a: any[]) => mockRefund(...a),
}));

const mockGenerateNextId = vi.fn();
vi.mock("@/lib/idGeneratorServer", () => ({
  generateNextId: (...a: any[]) => mockGenerateNextId(...a),
}));

const mockFindById = vi.fn();
const mockFindOne = vi.fn();
const mockCreate = vi.fn();
const mockFindByIdAndUpdate = vi.fn();
vi.mock("@/models/Invoice", () => ({
  default: {
    findById: (id: string) => ({ lean: () => mockFindById(id) }),
    // Both shapes: the route pre-checks with `.select().lean()`, and the shared settlement
    // library re-checks with a bare `.lean()`.
    findOne: (q: any) => ({
      select: () => ({ lean: () => mockFindOne(q) }),
      lean: () => mockFindOne(q),
    }),
    create: (...a: any[]) => mockCreate(...a),
    findByIdAndUpdate: (...a: any[]) => mockFindByIdAndUpdate(...a),
  },
}));

const mockOrderUpdate = vi.fn();
vi.mock("@/models/Order", () => ({
  default: { findByIdAndUpdate: (...a: any[]) => mockOrderUpdate(...a) },
}));

vi.mock("@/models/Manager", () => ({
  default: { findById: () => ({ lean: () => Promise.resolve(null) }) },
}));

import { POST } from "../route";
import { InsufficientBalanceError } from "@/lib/advanceBalanceLedger";

const RECEIPT = {
  _id: "REC-01001",
  type: "receipt",
  status: "pending",
  amount: 5000,
  customerId: "CUST-1",
  customerName: "Test Buyer",
  customerEmail: "buyer@test.com",
  orderId: "FS-10026",
  items: [],
  taxDetails: { isIntrastate: true, baseSubtotal: 5000, cgst: 0, sgst: 0, igst: 0, hsnSlabs: [] },
  shippingAddress: {},
  sellerInfo: { storeName: "FlexSell" },
  generatedAt: "01-Aug-2026",
  customerType: "B2B",
};

const call = (body: any, id = "REC-01001") =>
  POST(
    new Request(`http://localhost/api/invoices/${id}/settle`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) }
  );

describe("POST /api/invoices/[id]/settle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindById.mockResolvedValue({ ...RECEIPT });
    mockFindOne.mockResolvedValue(null);
    mockGenerateNextId.mockResolvedValue("INV-01001");
    mockCreate.mockImplementation((doc: any) => Promise.resolve(doc));
    mockFindByIdAndUpdate.mockResolvedValue({});
    mockOrderUpdate.mockResolvedValue({});
    mockSpendAccess.mockResolvedValue({
      payload: { userId: "ADM-1", role: "admin" },
      actor: { role: "Admin", name: "Admin" },
    });
  });

  describe("the zero-balance Advance Balance bug", () => {
    it("refuses a Advance Balance payment the balance cannot cover, and changes nothing", async () => {
      mockReserve.mockRejectedValue(new InsufficientBalanceError("store"));

      const res = await call({ method: "Store Wallet", clientRequestId: "req-1" });

      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.code).toBe("INSUFFICIENT_BALANCE");

      // Nothing was marked paid, no invoice was minted, no order was touched.
      expect(mockCreate).not.toHaveBeenCalled();
      expect(mockFindByIdAndUpdate).not.toHaveBeenCalled();
      expect(mockOrderUpdate).not.toHaveBeenCalled();
      expect(mockGenerateNextId).not.toHaveBeenCalled();
    });

    it("debits the Advance Balance before issuing the invoice", async () => {
      mockReserve.mockResolvedValue({ holdId: "HOLD-1", walletId: "W-1" });
      mockCapture.mockResolvedValue({ transactionId: "WTX-1", balancePaise: 100000 });

      const res = await call({ method: "Store Wallet", clientRequestId: "req-2" });

      expect(res.status).toBe(201);
      expect(mockReserve).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "CUST-1",
          walletType: "store",
          // The amount comes from the stored receipt, never the request body.
          amountPaise: 500000,
          clientRequestId: "req-2",
        })
      );
      expect(mockCapture).toHaveBeenCalledWith({ holdId: "HOLD-1", orderId: "FS-10026" });
    });

    it("requires the exact Advance Balance permission, not just a document permission", async () => {
      mockSpendAccess.mockResolvedValue({
        error: new Response(JSON.stringify({ message: "Forbidden: AdvanceBalance permission required" }), {
          status: 403,
        }),
      });

      const res = await call({ method: "Business Wallet", clientRequestId: "req-3" });

      expect(res.status).toBe(403);
      expect(mockReserve).not.toHaveBeenCalled();
      expect(mockSpendAccess).toHaveBeenCalledWith("business");
    });
  });

  describe("the receipt-number-on-an-invoice bug", () => {
    it("issues a new INV- document instead of mutating the receipt", async () => {
      const res = await call({ method: "Cash", transactionId: "CASH-102", clientRequestId: "req-4" });

      expect(res.status).toBe(201);
      expect(mockGenerateNextId).toHaveBeenCalledWith("invoice");

      const created = mockCreate.mock.calls[0][0];
      expect(created._id).toBe("INV-01001");
      expect(created._id.startsWith("REC-")).toBe(false);
      expect(created.type).toBe("invoice");
      // Back-link, and the unique index that makes double-settlement impossible.
      expect(created.sourceReceiptId).toBe("REC-01001");
    });

    it("retains the receipt and links it forward", async () => {
      await call({ method: "UPI", transactionId: "UTR-9", clientRequestId: "req-5" });

      const [receiptId, update] = mockFindByIdAndUpdate.mock.calls[0];
      expect(receiptId).toBe("REC-01001");
      expect(update.$set.settledByInvoiceId).toBe("INV-01001");
      expect(update.$set.status).toBe("paid");
      // The receipt keeps its own type — it is not converted into anything.
      expect(update.$set.type).toBeUndefined();
    });
  });

  describe("guards", () => {
    it("rejects a bank-rail payment with no transaction reference", async () => {
      const res = await call({ method: "UPI", transactionId: "   ", clientRequestId: "req-6" });
      expect(res.status).toBe(400);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    /**
     * Cash has no reference to give.
     *
     * This route used to invent `CASH-HAND-${Date.now()}` when the field was blank, and the
     * fix for that made a reference mandatory for every non-wallet method — which just moved
     * the fabrication to whoever had to type "CASH-1" to get past the form. Cash reconciles
     * against the cash book.
     */
    it("settles a cash payment with no reference, and stores none", async () => {
      const res = await call({ method: "Cash", transactionId: "   ", clientRequestId: "req-6b" });

      expect(res.status).toBe(201);
      const created = mockCreate.mock.calls[0][0];
      expect(created.transactionId).toBeUndefined();
    });

    /**
     * A gateway payment either carries a verified signature or it did not happen. The pay
     * modal used to offer "Razorpay Gateway" beside a free-text reference box, so any string
     * turned a receipt into a paid Tax Invoice with no money moved.
     */
    it("refuses a hand-recorded gateway payment", async () => {
      const res = await call({ method: "Razorpay", transactionId: "pay_faked123", clientRequestId: "req-6c" });

      expect(res.status).toBe(400);
      expect(mockCreate).not.toHaveBeenCalled();
      expect(mockReserve).not.toHaveBeenCalled();
    });

    it("refuses to settle a receipt that is already paid", async () => {
      mockFindById.mockResolvedValue({ ...RECEIPT, status: "paid", settledByInvoiceId: "INV-00999" });
      const res = await call({ method: "Cash", transactionId: "X", clientRequestId: "req-7" });
      expect(res.status).toBe(409);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("refuses when an invoice already exists for the receipt", async () => {
      mockFindOne.mockResolvedValue({ _id: "INV-00998" });
      const res = await call({ method: "Cash", transactionId: "X", clientRequestId: "req-8" });
      expect(res.status).toBe(409);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("refuses to settle anything that is not a receipt", async () => {
      mockFindById.mockResolvedValue({ ...RECEIPT, type: "invoice" });
      const res = await call({ method: "Cash", transactionId: "X", clientRequestId: "req-9" });
      expect(res.status).toBe(400);
    });

    it("requires an idempotency key", async () => {
      const res = await call({ method: "Cash", transactionId: "X" });
      expect(res.status).toBe(400);
    });

    it("refunds the capture when the invoice cannot be issued", async () => {
      mockReserve.mockResolvedValue({ holdId: "HOLD-2", walletId: "W-1" });
      mockCapture.mockResolvedValue({ transactionId: "WTX-2", balancePaise: 0 });
      mockCreate.mockRejectedValue(new Error("duplicate key"));
      mockRefund.mockResolvedValue({ refunded: true });

      const res = await call({ method: "Store Wallet", clientRequestId: "req-10" });

      expect(res.status).toBe(500);
      expect(mockRefund).toHaveBeenCalledWith(
        expect.objectContaining({ walletTransactionId: "WTX-2", reason: "invoice_issue_failed" })
      );
    });
  });
});
