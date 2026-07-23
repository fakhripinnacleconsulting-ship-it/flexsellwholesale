export interface IdFormatConfig {
  key: string;
  name: string;
  description: string;
  prefix: string;
  suffix: string;
  startCount: number;
  padLength: number;
  useHex?: boolean;
  isEnabled: boolean;
}

export const DEFAULT_ID_FORMATS: IdFormatConfig[] = [
  {
    key: "order",
    name: "Orders",
    description: "Unique tracking numbers for B2B buyer orders",
    prefix: "FS-",
    suffix: "",
    startCount: 10026,
    padLength: 5,
    isEnabled: true
  },
  {
    key: "invoice",
    name: "Invoices",
    description: "Official GST tax invoices generated for orders",
    prefix: "INV-",
    suffix: "",
    startCount: 1001,
    padLength: 5,
    isEnabled: true
  },
  {
    key: "receipt",
    name: "Receipts",
    description: "Payment confirmation receipts issued to buyers",
    prefix: "REC-",
    suffix: "",
    startCount: 1001,
    padLength: 5,
    isEnabled: true
  },
  {
    key: "quote",
    name: "Proforma Quotes",
    description: "Wholesale proforma quotes issued to B2B buyers",
    prefix: "QUO-",
    suffix: "",
    startCount: 1001,
    padLength: 5,
    isEnabled: true
  },
  {
    key: "customer",
    name: "Customers",
    description: "Unique account IDs assigned to B2B buyers",
    prefix: "FSW-",
    suffix: "",
    startCount: 1,
    padLength: 4,
    isEnabled: true
  },
  {
    key: "product",
    name: "Products",
    description: "Custom stock SKU/product identification numbers",
    prefix: "PROD-",
    suffix: "",
    startCount: 101,
    padLength: 4,
    isEnabled: true
  },
  {
    key: "category",
    name: "Categories",
    description: "Reference IDs for product categories",
    prefix: "CAT-",
    suffix: "",
    startCount: 1,
    padLength: 3,
    isEnabled: true
  },
  {
    key: "collection",
    name: "Collections",
    description: "Reference IDs for product collections",
    prefix: "COL-",
    suffix: "",
    startCount: 1,
    padLength: 3,
    isEnabled: true
  },
  {
    key: "coupon",
    name: "Coupons",
    description: "Discount coupon codes / campaign tracking IDs",
    prefix: "COUP-",
    suffix: "",
    startCount: 1,
    padLength: 3,
    isEnabled: true
  },
  {
    key: "inquiry",
    name: "Inquiries",
    description: "Contact and custom RFQ inquiry ticket IDs",
    prefix: "INQ-",
    suffix: "",
    startCount: 1001,
    padLength: 4,
    isEnabled: true
  },
  {
    key: "review",
    name: "Reviews",
    description: "Customer review moderation ticket IDs",
    prefix: "REV-",
    suffix: "",
    startCount: 1001,
    padLength: 4,
    isEnabled: true
  }
];

export function formatIdPreview(
  prefix: string = "",
  count: number = 1,
  padLength: number = 4,
  suffix: string = "",
  useHex: boolean = false
): string {
  const num = Math.max(1, count || 1);
  const seqStr = useHex ? num.toString(16).toUpperCase() : String(num).padStart(padLength || 1, "0");
  return `${prefix || ""}${seqStr}${suffix || ""}`;
}

export function generateNextClientMockId(type: string): string {
  if (typeof window === "undefined") return `${type.toUpperCase()}-${Date.now()}`;
  try {
    const cmsRaw = localStorage.getItem("flexsell-cms-storage") || localStorage.getItem("idFormats");
    let formats: IdFormatConfig[] = DEFAULT_ID_FORMATS;
    if (cmsRaw) {
      const parsed = JSON.parse(cmsRaw);
      if (Array.isArray(parsed)) formats = parsed;
      else if (parsed?.idFormats && Array.isArray(parsed.idFormats)) formats = parsed.idFormats;
      else if (typeof parsed === "object") {
        formats = DEFAULT_ID_FORMATS.map(def => (parsed[def.key] ? { ...def, ...parsed[def.key] } : def));
      }
    }

    const currentConfig = formats.find((f) => f.key === type) || DEFAULT_ID_FORMATS.find((f) => f.key === type) || {
      key: type, name: type, description: "", prefix: `${type.toUpperCase()}-`, suffix: "", startCount: 1001, padLength: 4, isEnabled: true
    };

    const counterKey = `flexsell_mock_counter_${type}`;
    let currentSeq = Number(localStorage.getItem(counterKey));
    if (!currentSeq || isNaN(currentSeq)) {
      currentSeq = currentConfig.startCount;
    }
    localStorage.setItem(counterKey, String(currentSeq + 1));

    return formatIdPreview(
      currentConfig.prefix,
      currentSeq,
      currentConfig.padLength,
      currentConfig.suffix,
      !!currentConfig.useHex
    );
  } catch {
    return `${type.toUpperCase()}-${Date.now()}`;
  }
}
