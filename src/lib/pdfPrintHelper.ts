/**
 * Utility for formatting relevant document titles for PDF downloads and browser printing.
 * If a direct document ID is available, it uses "[DocType]_[ReferenceId]" (e.g. Invoice_FS-10025).
 * If no reference ID is available, it appends a timestamp: "[DocType]_[YYYYMMDD_HHMM]".
 */

export function generateDocumentTitle(
  docType: "Invoice" | "RECEIPT" | "Quote" | "Shipping_Label" | "Wholesale_Catalog" | "Barcode_Labels" | string,
  referenceId?: string,
  customerName?: string
): string {
  // Clean docType
  const cleanType = docType.trim().replace(/\s+/g, "_");

  // Clean reference ID (remove special characters that might mess up file paths)
  const cleanRef = referenceId && referenceId.trim() !== ""
    ? referenceId.trim().replace(/[^a-zA-Z0-9_-]/g, "")
    : "";

  const cleanName = customerName && customerName.trim() !== ""
    ? customerName.trim().replace(/[^a-zA-Z0-9_-]/g, "_")
    : "";

  if (cleanRef && cleanName) {
    return `${cleanType}_${cleanName}_${cleanRef}`;
  } else if (cleanRef) {
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
  customerName?: string,
  customAction?: () => void
) {
  if (typeof window === "undefined") return;

  const originalTitle = document.title;
  const printableTitle = generateDocumentTitle(docType, referenceId, customerName);

  document.title = printableTitle;

  let restored = false;
  const restoreTitle = () => {
    if (restored) return;
    restored = true;
    document.title = originalTitle;
    window.removeEventListener("afterprint", onAfterPrint);
    window.removeEventListener("focus", restoreTitle);
  };

  const onAfterPrint = () => {
    // Wait until user closes the print dialog and focuses back on the main window
    window.addEventListener("focus", restoreTitle, { once: true });
    // Also restore after a generous delay if focus event doesn't trigger
    setTimeout(restoreTitle, 30000);
  };

  window.addEventListener("afterprint", onAfterPrint, { once: true });

  if (customAction) {
    customAction();
  } else {
    window.print();
  }

  // Fallback title restoration after 30 seconds
  setTimeout(restoreTitle, 30000);
}

