/**
 * Utility for formatting relevant document titles for PDF downloads and browser printing.
 * If a direct document ID is available, it uses "[DocType]_[ReferenceId]" (e.g. Invoice_FS-10025).
 * If no reference ID is available, it appends a timestamp: "[DocType]_[YYYYMMDD_HHMM]".
 */

export function generateDocumentTitle(
  docType: "Invoice" | "RECEIPT" | "Quote" | "Shipping_Label" | "Wholesale_Catalog" | "Barcode_Labels" | string,
  referenceId?: string
): string {
  // Clean docType
  const cleanType = docType.trim().replace(/\s+/g, "_");

  // Clean reference ID (remove special characters that might mess up file paths)
  const cleanRef = referenceId && referenceId.trim() !== ""
    ? referenceId.trim().replace(/[^a-zA-Z0-9_-]/g, "")
    : "";

  if (cleanRef) {
    // Direct document ID available -> Use Name and ID (e.g., Invoice_FS-10028, RECEIPT_INV-9001)
    return `${cleanType}_${cleanRef}`;
  }

  // Fallback to timestamp if no direct document ID is present
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");

  const timestamp = `${year}${month}${day}_${hours}${minutes}`;
  return `${cleanType}_${timestamp}`;
}

export function triggerPrintWithTitle(
  docType: string,
  referenceId?: string,
  customAction?: () => void
) {
  if (typeof window === "undefined") return;

  const originalTitle = document.title;
  const printableTitle = generateDocumentTitle(docType, referenceId);

  document.title = printableTitle;

  const restoreTitle = () => {
    document.title = originalTitle;
    window.removeEventListener("afterprint", restoreTitle);
  };

  window.addEventListener("afterprint", restoreTitle);

  if (customAction) {
    customAction();
  } else {
    window.print();
  }

  // Fallback title restoration if afterprint doesn't fire
  setTimeout(() => {
    document.title = originalTitle;
  }, 2500);
}
