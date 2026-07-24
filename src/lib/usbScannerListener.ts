/**
 * USB / Bluetooth HID Keyboard Wedge Scanner Listener Utility.
 * Hardware scanners send character keypresses rapidly (<35ms delta) terminated by Enter.
 */

export interface USBScannerListenerOptions {
  onScan: (scannedText: string) => void;
  maxInterKeyDelayMs?: number;
  minBarcodeLength?: number;
}

export function initUSBScannerListener(options: USBScannerListenerOptions): () => void {
  const maxDelay = options.maxInterKeyDelayMs ?? 35;
  const minLength = options.minBarcodeLength ?? 3;

  let buffer = "";
  let lastKeyTime = 0;

  const handleKeyDown = (e: KeyboardEvent) => {
    // Ignore input if focused inside form controls unless marked with data-barcode-input
    const target = e.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) &&
      !target.getAttribute("data-barcode-input")
    ) {
      return;
    }

    const now = Date.now();
    const timeDiff = now - lastKeyTime;
    lastKeyTime = now;

    if (e.key === "Enter") {
      if (buffer.length >= minLength && timeDiff <= maxDelay * 3) {
        e.preventDefault();
        const finalScanned = buffer;
        buffer = "";
        options.onScan(finalScanned);
      }
      buffer = "";
      return;
    }

    if (e.key.length === 1) {
      if (timeDiff > maxDelay) {
        // Reset buffer if delay between keystrokes is too large
        buffer = e.key;
      } else {
        buffer += e.key;
      }
    }
  };

  if (typeof window !== "undefined") {
    window.addEventListener("keydown", handleKeyDown);
  }

  return () => {
    if (typeof window !== "undefined") {
      window.removeEventListener("keydown", handleKeyDown);
    }
  };
}
