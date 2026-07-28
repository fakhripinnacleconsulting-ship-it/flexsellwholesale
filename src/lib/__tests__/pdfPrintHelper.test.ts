// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateDocumentTitle, triggerPrintWithTitle } from "../pdfPrintHelper";

describe("pdfPrintHelper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateDocumentTitle", () => {
    it("should use Name and ID (without timestamp) when document ID is available", () => {
      expect(generateDocumentTitle("Invoice", "FS-10025")).toBe("Invoice_FS-10025");
      expect(generateDocumentTitle("RECEIPT", "REC-9001")).toBe("RECEIPT_REC-9001");
      expect(generateDocumentTitle("Quote", "QT-88231")).toBe("Quote_QT-88231");
      expect(generateDocumentTitle("Shipping_Label", "FS-10028")).toBe("Shipping_Label_FS-10028");
    });

    it("should sanitize whitespace and special characters in document IDs", () => {
      expect(generateDocumentTitle("Invoice", "INV #2026/07")).toBe("Invoice_INV202607");
    });

    it("should fallback to timestamp when no document ID is available", () => {
      const title = generateDocumentTitle("Wholesale Catalog");
      expect(title).toMatch(/^Wholesale_Catalog_\d{8}_\d{4}$/);
    });
  });

  describe("triggerPrintWithTitle", () => {
    it("should set document.title to Name and ID and trigger window.print()", () => {
      const originalTitle = document.title;
      const printSpy = vi.spyOn(window, "print").mockImplementation(() => {});

      triggerPrintWithTitle("Invoice", "FS-10025");

      expect(document.title).toBe("Invoice_FS-10025");
      expect(printSpy).toHaveBeenCalled();

      // Dispatch afterprint event
      window.dispatchEvent(new Event("afterprint"));
      expect(document.title).toBe(originalTitle);

      printSpy.mockRestore();
    });
  });
});
