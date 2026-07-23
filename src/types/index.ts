export interface BaseDocument {
  _id: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Category extends BaseDocument {
  name: string;
  slug: string;
  image: string;
  description?: string;
  parentId?: string | null;
  isActive: boolean;
  order: number;
}

export interface SubVariant {
  id: string;
  size: string;
  weight: string;
  weightGrams?: number | null;
  mrp: number;
  b2cPrice: number;
  b2bPrice: number;
  dropshippingPrice: number;
  b2bMoq?: number | null;
  discount: number;
  stock: number;
  sku: string;
  barcode?: string;
  barcodeSource?: "auto" | "manual" | "image";
  barcodeImage?: string | null;
  isActive?: boolean;
}

export interface ProductImage {
  url: string;
  alt: string;
}

export interface ColorVariant {
  color: string;
  dimensions: string;
  lengthCm?: number | null;
  breadthCm?: number | null;
  heightCm?: number | null;
  images: (string | ProductImage)[];
  subVariants: SubVariant[];
}

export interface HsnRecord extends BaseDocument {
  code: string;       // e.g. "3924"
  gstRate: number;    // e.g. 18
  description: string;
  isActive: boolean;
}

export interface APlusBlock {
  id: string;
  type: "text" | "image" | "image-text" | "features";
  title?: string;
  content?: string;
  imageUrl?: string;
  alt?: string;
  features?: string[];
}

export interface Product extends BaseDocument {
  title: string;
  slug: string;
  description: string;
  categoryId: string;
  vendorId?: string;
  rating: number;
  reviewCount: number;
  tags: string[];
  cardTags?: string[];
  isActive: boolean;
  totalStock: number;
  colorVariants: ColorVariant[];
  aPlusContent?: APlusBlock[];
  
  // Dynamic B2B Indian Tax, MOQ, and SEO fields
  hsnCode?: string;
  gstRate?: number;
  priceIncludesGst?: boolean;
  defaultPriceTier?: "B2C" | "B2B" | "Dropshipping";
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string;
  fieldVisibility?: {
    showDescription: boolean;
    showSizes: boolean;
    showWeights: boolean;
    showDimensions: boolean;
    showImages: boolean;
  };

  // Product-level Barcode Configuration
  barcode?: string;
  barcodeSource?: "auto" | "manual" | "image";
  barcodeImage?: string | null;
}

export interface Banner extends BaseDocument {
  title: string;
  subtitle?: string;
  image: string;
  link: string;
  position: "hero" | "sidebar" | "collection" | "footer";
  isActive: boolean;
  order: number;
}

export interface CartItem {
  id: string; // Dynamic combination of productID + selected variants
  productId?: string;
  product: Product;
  selectedVariants: Record<string, string>;
  quantity: number;
  pricePerUnit: number;
  priceTier?: "B2C" | "B2B";
}

export interface HistoryEvent {
  status: string;
  timestamp: string;
  description: string;
}

export interface ShiprocketOrderDetails {
  orderId?: number;
  shipmentId?: number;
  awbCode?: string;
  courierId?: number;
  courierName?: string;
  labelUrl?: string;
  manifestUrl?: string;
  pickupScheduledDate?: string;
  pickupTokenNumber?: string;
  currentStatus?: string;
  currentStatusCode?: number;
  etd?: string;
  trackingUrl?: string;
  fulfillmentStep?: string;
  failedAt?: string | null;
  failureReason?: string | null;
}

export interface ShipmentDetails {
  type: "self" | "third-party" | "shiprocket";
  carrierName?: string;
  trackingId: string;
  trackingUrl?: string;
  shippedAt?: string;
  deliveredAt?: string;
  estimatedDelivery?: string;
  notes?: string;
  shiprocket?: ShiprocketOrderDetails;
}

export interface Order extends BaseDocument {
  date: string;
  amount: number;
  status: "Placed" | "Pending" | "Confirmed" | "Processing" | "Awaiting Shipment" | "In Transit" | "Shipped" | "Delivered" | "Cancelled";
  statusClass: string;
  itemsCount: number;
  customerName: string;
  shippingAddress: {
    firstName: string;
    lastName: string;
    email: string;
    company?: string;
    address: string;
    apartment?: string;
    city: string;
    state: string;
    pinCode: string;
    phone: string;
    gstin?: string;
  };
  items: CartItem[];
  shipmentDetails?: ShipmentDetails;
  history: HistoryEvent[];
  paymentMethod?: "Bank Transfer" | "Razorpay" | "UPI" | "COD";
  paymentStatus?: "Pending" | "Paid" | "Failed";
  transactionId?: string;
  invoiceId?: string;
  quoteId?: string;
  salesperson?: string;
  couponCode?: string;
  couponDiscount?: number;
  orderType?: "B2B" | "B2C";
  origin?: "self" | "website";
}

export interface HsnSlab {
  hsnCode: string;
  gstRate: number;
  baseAmount: number;
  totalTax: number;
  cgst: number;
  sgst: number;
  igst: number;
}

export interface TaxBreakdown {
  isIntrastate: boolean;
  baseSubtotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  hsnSlabs: HsnSlab[];
}

export interface SellerInfo {
  storeName: string;
  gstin: string;
  address: string;
  email: string;
  phone: string;
  logoUrl?: string;
}

export interface Invoice extends BaseDocument {
  type: "invoice" | "receipt" | "quote";
  orderId?: string;
  customerId?: string;
  customerName: string;
  customerEmail: string;
  customerGstin?: string;
  items: CartItem[];
  amount: number;
  taxDetails: TaxBreakdown;
  shippingAddress: Order["shippingAddress"];
  paymentMethod?: string;
  paymentStatus?: string;
  transactionId?: string;
  sellerInfo: SellerInfo;
  notes?: string;
  generatedAt: string;
  generatedBy: string;
  salesperson?: string;
  isArchived?: boolean;
  status:
    | "draft"
    | "finalized"
    | "sent"
    | "accepted"
    | "rejected"
    | "expired"
    | "converted"
    | "cancelled"
    | "pending"
    | "failed"
    | "refunded"
    | "paid"
    | "void"
    | "archived";
  couponCode?: string;
  couponDiscount?: number;
  customerType?: "B2C" | "B2B" | "Dropshipping";
}

export interface SavedAddress {
  _id: string;
  name: string;
  firstName: string;
  lastName: string;
  company?: string;
  address: string;
  apartment?: string;
  city: string;
  state: string;
  pinCode: string;
  phone: string;
  gstin?: string;
  isDefault: boolean;
}

export interface Customer {
  _id: string;
  name: string;
  email: string;
  password?: string;
  role?: "customer" | "admin";
  resetPasswordToken?: string;
  resetPasswordExpires?: string;
  company?: string;
  address: string;
  city: string;
  state: string;
  pinCode: string;
  phone: string;
  initials: string;
  gstin?: string;
  customerTypes: ("B2C" | "B2B" | "Dropshipping")[];
  addresses?: SavedAddress[];
  wishlist?: string[];
}

export interface Review extends BaseDocument {
  productId: string;
  productTitle?: string;
  productSlug?: string;
  customerId?: string;
  customerName: string;
  rating: number;
  title: string;
  comment: string;
  status: "pending" | "approved" | "rejected";
  adminResponse?: string;
}

export interface Coupon extends BaseDocument {
  code: string;
  discountType: "percentage" | "flat";
  discountValue: number;
  minOrderValue: number;
  maxDiscount?: number;
  expiryDate: string;
  isActive: boolean;
  isPersonalized?: boolean;
  allowedCustomers?: string[];
  usageLimit?: number | null;
  usageLimitPerCustomer?: number;
  usedCount?: number;
  usedBy?: string[];
}

export interface Notification extends BaseDocument {
  customerId: string;
  recipientRole?: "customer" | "admin";
  title: string;
  message: string;
  type: "info" | "order" | "success" | "warning" | "security";
  isRead: boolean;
  link?: string;
  actionType?: string;
  entityId?: string;
}

export interface NotificationPreferences {
  userId: string;
  emailNotifications: boolean;
  pushNotifications: boolean;
  categories: {
    orders: boolean;
    shipments: boolean;
    payments: boolean;
    quotes: boolean;
    invoices: boolean;
    security: boolean;
    system: boolean;
  };
}

export interface PushSubscriptionInfo {
  _id?: string;
  userId: string;
  role: "customer" | "admin";
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userAgent?: string;
  isActive: boolean;
  lastUsedAt?: string;
}

export interface ShippingWeightSlab {
  _id?: string;
  fromGram: number;
  uptoGram: number;
  amount: number;
}

export interface ShiprocketConfig {
  enabled?: boolean;
  email?: string;
  password?: string;
  webhookToken?: string;
  channelId?: string;
  pickupAddress?: {
    name?: string;
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
    pinCode?: string;
    country?: string;
  };
}

export interface ShippingConfig {
  _id?: string;
  weightSlabs: ShippingWeightSlab[];
  b2bFixedCharge: number;
  shiprocket?: ShiprocketConfig;
  updatedAt?: string;
}

export interface CollectionCondition {
  field: "tag" | "category" | "price" | "title" | "stock" | "vendor";
  operator: "equals" | "not_equals" | "contains" | "starts_with" | "greater_than" | "less_than";
  value: string;
}

export interface CollectionRules {
  matchType: "all" | "any";
  conditions: CollectionCondition[];
}

export interface Collection extends BaseDocument {
  title: string;
  slug: string;
  description?: string;
  type: "manual" | "smart";
  image?: string;
  bannerImage?: string;
  productIds?: string[];
  rules?: CollectionRules | null;
  linkedCategoryIds?: string[];
  isActive: boolean;
  isFeatured: boolean;
  order: number;
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string;
}
