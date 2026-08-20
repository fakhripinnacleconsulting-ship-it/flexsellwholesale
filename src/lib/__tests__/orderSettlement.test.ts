import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The regression suite for the settlement paperwork.
 *
 * Two bugs shipped while 355 tests passed, because the wallet engine and the *one* correct
 * settlement route were covered and the other four payment paths were not:
 *
 *   - the wallet routes issued no invoice at all, leaving a paid order beside a `pending`
 *     receipt and a "Mark Paid" button for money already taken;
 *   - Razorpay flipped `type` on the receipt in place, producing a Tax Invoice that kept its
 *     `RCP-` number because MongoDB will not change an assigned `_id`.
 *
 * These tests exercise the shared library all of them now call.
 */

const mockFindById = vi.fn();
const mockFindOne = vi.fn();
const mockCreate = vi.fn();
const mockInvoiceUpdate = vi.fn();
vi.mock("@/models/Invoice", () => ({
  default: {
    findById: (id: string) => ({ lean: () => mockFindById(id) }),
    findOne: (q: any) => ({ lean: () => mockFindOne(q) }),
    create: (...a: any[]) => mockCreate(...a),
    findByIdAndUpdate: (...a: any[]) => mockInvoiceUpdate(...a),
  },
}));

const mockOrderUpdate = vi.fn();
vi.mock("@/models/Order", () => ({
  default: { findByIdAndUpdate: (...a: any[]) => mockOrderUpdate(...a) },
}));

const mockGenerateNextId = vi.fn();
vi.mock("@/lib/idGeneratorServer", () => ({
  generateNextId: (...a: any[]) => mockGenerateNextId(...a),
}));

import { issueTaxInvoiceForReceipt, settleOrderDocuments } from "@/lib/orderSettlement";

const RECEIPT = {
  _id: "REC-01001",
  type: "receipt",
  status: "pending",
  amount: 5000,
  customerId: "CUST-1",
  customerName: "Test Buyer",
  customerEmail: "buyer@test.com",
  orderId: "FS-10026",
  notes: "original note",
  items: [],
  taxDetails: { isIntrastate: true, baseSubtotal: 5000, cgst: 0, sgst: 0, igst: 0, hsnSlabs: [] },
  shippingAddress: {},
  sellerInfo: { storeName: "FlexSell" },
  generatedAt: "01-Aug-2026",
  customerType: "B2B",
};

/** The duplicate-key error MongoDB raises on the unique `sourceReceiptId` index. */
function duplicateKeyError() {
  return Object.assign(new Error("E11000 duplicate key"), { code: 11000 });
}

describe("orderSettlement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindOne.mockResolvedValue(null);
    mockFindById.mockResolvedValue(null);
    mockGenerateNextId.mockResolvedValue("INV-01001");
    mockCreate.mockImplementation((doc: any) => Promise.resolve(doc));
    mockInvoiceUpdate.mockResolvedValue({});
    mockOrderUpdate.mockResolvedValue({});
  });

  describe("issueTaxInvoiceForReceipt", () => {
    it("issues a separately numbered INV- document rather than renumbering the receipt", async () => {
      const result = await issueTaxInvoiceForReceipt({
        receipt: { ...RECEIPT },
        method: "Wallet",
        transactionId: "WTX-1",
      });

      expect(result.alreadyIssued).toBe(false);
      expect(mockGenerateNextId).toHaveBeenCalledWith("invoice");

      const created = mockCreate.mock.calls[0][0];
      expect(created._id).toBe("INV-01001");
      expect(created._id.startsWith("REC-")).toBe(false);
      expect(created.type).toBe("invoice");
      expect(created.status).toBe("paid");
      expect(created.paymentStatus).toBe("Paid");
      // The back-link the unique sparse index is built on.
      expect(created.sourceReceiptId).toBe("REC-01001");
    });

    it("carries the receipt's content across but never its identity fields", async () => {
      await issueTaxInvoiceForReceipt({
        receipt: { ...RECEIPT, createdAt: "yesterday", settledByInvoiceId: undefined },
        method: "Cash",
        transactionId: "CASH-1",
      });

      const created = mockCreate.mock.calls[0][0];
      expect(created.customerName).toBe("Test Buyer");
      expect(created.customerType).toBe("B2B");
      expect(created.amount).toBe(5000);
      expect(created.createdAt).toBeUndefined();
      expect(created.settledByInvoiceId).toBeUndefined();
    });

    it("retains the receipt, marks it paid, and links it forward", async () => {
      await issueTaxInvoiceForReceipt({
        receipt: { ...RECEIPT },
        method: "UPI",
        transactionId: "UTR-9",
      });

      const [receiptId, update] = mockInvoiceUpdate.mock.calls[0];
      expect(receiptId).toBe("REC-01001");
      expect(update.$set.status).toBe("paid");
      expect(update.$set.settledByInvoiceId).toBe("INV-01001");
      // The receipt keeps its own type — it is not converted into anything.
      expect(update.$set.type).toBeUndefined();
    });

    it("points the order at the tax invoice and records who settled it", async () => {
      await issueTaxInvoiceForReceipt({
        receipt: { ...RECEIPT },
        method: "Wallet",
        transactionId: "WTX-3",
        walletTransactionId: "WTX-3",
        walletType: "business",
        walletAmount: 5000,
        actor: { role: "Manager", name: "Priya", userId: "MGR-2" },
      });

      const [orderId, update] = mockOrderUpdate.mock.calls[0];
      expect(orderId).toBe("FS-10026");
      expect(update.$set.paymentStatus).toBe("Paid");
      expect(update.$set.invoiceId).toBe("INV-01001");
      expect(update.$set.paymentMethod).toBe("Wallet");
      expect(update.$set.walletType).toBe("business");
      expect(update.$set.walletAmount).toBe(5000);

      const event = update.$push.history.$each[0];
      expect(event.actor).toEqual({ role: "Manager", name: "Priya", userId: "MGR-2" });
      expect(event.internalNote).toContain("INV-01001");
      // The customer is never told which staff member acted.
      expect(event.customerNote).not.toContain("Priya");
    });

    it("leaves an unmapped payment method off the order rather than breaking its enum", async () => {
      await issueTaxInvoiceForReceipt({
        receipt: { ...RECEIPT },
        method: "NEFT/RTGS",
        transactionId: "UTR-11",
      });

      const [, update] = mockOrderUpdate.mock.calls[0];
      expect(update.$set.paymentMethod).toBeUndefined();
      // It is still recorded faithfully on the document itself.
      expect(mockCreate.mock.calls[0][0].paymentMethod).toBe("NEFT/RTGS");
    });

    it("is a no-op when the receipt already names its invoice", async () => {
      mockFindById.mockResolvedValue({ _id: "INV-00900" });

      const result = await issueTaxInvoiceForReceipt({
        receipt: { ...RECEIPT, settledByInvoiceId: "INV-00900" },
        method: "Cash",
        transactionId: "CASH-2",
      });

      expect(result.alreadyIssued).toBe(true);
      expect(result.invoiceId).toBe("INV-00900");
      expect(mockCreate).not.toHaveBeenCalled();
      expect(mockGenerateNextId).not.toHaveBeenCalled();
      expect(mockOrderUpdate).not.toHaveBeenCalled();
    });

    it("is a no-op when an invoice already points back at the receipt", async () => {
      mockFindOne.mockResolvedValue({ _id: "INV-00901" });

      const result = await issueTaxInvoiceForReceipt({
        receipt: { ...RECEIPT },
        method: "Cash",
        transactionId: "CASH-3",
      });

      expect(result.alreadyIssued).toBe(true);
      expect(result.invoiceId).toBe("INV-00901");
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("resolves a lost race on the unique index into the winner's invoice", async () => {
      // The webhook and the browser callback arriving together: both pass the application
      // checks, only one can insert. Losing that race is a success, not a failure.
      mockCreate.mockRejectedValueOnce(duplicateKeyError());
      mockFindOne.mockResolvedValueOnce(null).mockResolvedValueOnce({ _id: "INV-01000" });

      const result = await issueTaxInvoiceForReceipt({
        receipt: { ...RECEIPT },
        method: "Razorpay",
        transactionId: "pay_1",
      });

      expect(result.alreadyIssued).toBe(true);
      expect(result.invoiceId).toBe("INV-01000");
      // The winner already did this work; the loser must not redo it.
      expect(mockInvoiceUpdate).not.toHaveBeenCalled();
      expect(mockOrderUpdate).not.toHaveBeenCalled();
    });

    it("rethrows a write failure that is not a lost race", async () => {
      mockCreate.mockRejectedValueOnce(new Error("connection reset"));

      await expect(
        issueTaxInvoiceForReceipt({ receipt: { ...RECEIPT }, method: "Cash", transactionId: "X" })
      ).rejects.toThrow("connection reset");
    });

    it("issues the invoice for a standalone receipt with no order behind it", async () => {
      const { orderId, ...standalone } = RECEIPT;
      void orderId;

      const result = await issueTaxInvoiceForReceipt({
        receipt: standalone,
        method: "Cash",
        transactionId: "CASH-4",
      });

      expect(result.invoiceId).toBe("INV-01001");
      expect(mockOrderUpdate).not.toHaveBeenCalled();
    });
  });

  describe("settleOrderDocuments", () => {
    it("finds the order's receipt and issues its tax invoice", async () => {
      mockFindOne.mockResolvedValueOnce({ ...RECEIPT }).mockResolvedValueOnce(null);

      const result = await settleOrderDocuments({
        orderId: "FS-10026",
        method: "Wallet",
        transactionId: "WTX-7",
        walletTransactionId: "WTX-7",
        walletType: "store",
      });

      expect(mockFindOne).toHaveBeenCalledWith({ orderId: "FS-10026", type: "receipt" });
      expect(result).toEqual({ status: "issued", invoiceId: "INV-01001", receiptId: "REC-01001" });
    });

    it("reports an order with no receipt as a normal outcome, not a failure", async () => {
      // An order placed by staff as already-paid is born with an INV- and never has a receipt.
      mockFindOne.mockResolvedValue(null);

      const result = await settleOrderDocuments({ orderId: "FS-10027", method: "Cash" });

      expect(result).toEqual({ status: "no_receipt" });
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("is idempotent across the webhook and the browser callback", async () => {
      mockFindOne
        // first call: locate the receipt; second: no invoice yet → issue it
        .mockResolvedValueOnce({ ...RECEIPT })
        .mockResolvedValueOnce(null)
        // second settlement: locate the receipt; the invoice now exists
        .mockResolvedValueOnce({ ...RECEIPT })
        .mockResolvedValueOnce({ _id: "INV-01001" });

      const first = await settleOrderDocuments({ orderId: "FS-10026", method: "Razorpay" });
      const second = await settleOrderDocuments({ orderId: "FS-10026", method: "Razorpay" });

      expect(first.status).toBe("issued");
      expect(second.status).toBe("already_issued");
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });
  });
});
