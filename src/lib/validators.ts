import { z } from "zod";

export const loginSchema = z.object({
  identifier: z.string().min(1, "Username/Email/ID is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const kycDocumentsSchema = z.object({
  gstCertificate: z.string().optional(),
  signaturePhoto: z.string().optional(),
  aadharCard: z.string().optional(),
  passportPhoto: z.string().optional(),
  panCard: z.string().optional(),
  chequePhoto: z.string().optional(),
});

export const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email format"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, "Password must contain at least one uppercase letter, one lowercase letter, and one number"),
  company: z.string().optional(),
  storeName: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pinCode: z.string().optional(),
  phone: z.string().min(10, "Phone number must be at least 10 digits"),
  gstin: z.string().optional(),
  skipAddress: z.boolean().optional(),
  customerTypes: z.array(z.enum(["B2C", "B2B", "Dropshipping"]))
    .min(1, "At least one customer type is required")
    .max(3)
    .default(["B2C"]),
  kycDocuments: kycDocumentsSchema.optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email format"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token is required"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, "Password must contain at least one uppercase letter, one lowercase letter, and one number"),
});

// Category validation schema
export const categorySchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  slug: z.string().min(2, "Slug must be at least 2 characters"),
  image: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  order: z.number().int().optional(),
  parentId: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

// Coupon validation schema
export const couponSchema = z.object({
  code: z.string().min(2, "Coupon code must be at least 2 characters").toUpperCase(),
  discountType: z.enum(["percentage", "flat"]),
  discountValue: z.number().positive("Discount value must be positive"),
  minOrderValue: z.number().nonnegative("Minimum order value cannot be negative").default(0),
  maxDiscount: z.number().positive().optional(),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expiry date must be YYYY-MM-DD"),
  isActive: z.boolean().default(true),
  isPersonalized: z.boolean().default(false).optional(),
  allowedCustomers: z.array(z.string()).default([]).optional(),
  usageLimit: z.number().positive().optional().nullable(),
  usageLimitPerCustomer: z.number().positive().default(1).optional(),
});

// Review validation schema
export const reviewSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  rating: z.number().int().min(1).max(5, "Rating must be between 1 and 5"),
  title: z.string().min(2, "Title must be at least 2 characters").max(100),
  comment: z.string().min(10, "Comment must be at least 10 characters").max(1000),
});

// Order validation schema
export const orderSchema = z.object({
  items: z.array(z.object({
    id: z.string().optional().default(() => `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`),
    productId: z.string().optional(),
    product: z.any().optional(),
    productTitle: z.string().optional(),
    name: z.string().optional(),
    title: z.string().optional(),
    selectedVariants: z.record(z.string(), z.string()).optional().default({}),
    quantity: z.number().int().positive("Quantity must be at least 1"),
    pricePerUnit: z.number().positive("Price must be positive"),
  }).passthrough()).min(1, "Order must contain at least 1 item"),
  amount: z.number().positive("Order amount must be positive"),
  shippingAddress: z.object({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    email: z.string().email("Invalid email format"),
    company: z.string().optional().nullable(),
    address: z.string().min(5, "Address must be at least 5 characters"),
    apartment: z.string().optional().nullable(),
    city: z.string().min(2, "City is required"),
    state: z.string().min(2, "State is required"),
    pinCode: z.string().regex(/^\d{6}$/, "Pin code must be exactly 6 digits"),
    phone: z.string().min(10, "Phone number must be at least 10 digits"),
    gstin: z.string().optional().nullable(),
  }),
  status: z.enum(["Processing", "Shipped", "Delivered", "Cancelled"]).optional(),
  paymentDetails: z.object({
    /**
     * Must stay in step with the `paymentMethod` enum on the Order model.
     *
     * "Wallet" was missing, so every wallet checkout failed Zod validation before it reached
     * the wallet at all — the order was never created and the buyer saw a generic 500.
     * A wallet order is always created `Pending` here and moved to `Paid` by
     * /api/wallet/pay-order once the debit succeeds; the method alone never settles anything.
     */
    paymentMethod: z.enum(["Bank Transfer", "Razorpay", "UPI", "COD", "Wallet", "Cash"]),
    paymentStatus: z.enum(["Pending", "Paid", "Failed"]),
    transactionId: z.string().optional(),
  }).optional(),
  couponCode: z.string().optional(),
  couponDiscount: z.number().optional(),
  packagingCharge: z.number().optional(),
  shippingCharge: z.number().optional(),
  quoteId: z.string().optional(),
  salesperson: z.string().optional(),
});

// Product validation schema
export const subVariantSchema = z.object({
  id: z.string(),
  size: z.string(),
  weight: z.string().min(1, "Weight is required"),
  weightGrams: z.number().nonnegative("Weight in grams cannot be negative").nullable().optional().default(null),
  mrp: z.number().nonnegative("MRP cannot be negative").default(0),
  b2cPrice: z.number().nonnegative("B2C Price cannot be negative").default(0),
  b2bPrice: z.number().nonnegative("B2B Price cannot be negative").default(0),
  dropshippingPrice: z.number().nonnegative("Dropshipping Price cannot be negative").default(0),
  b2bMoq: z.number().int("MOQ must be a whole number").nonnegative("MOQ cannot be negative").nullable().optional().default(null),
  packagingCharge: z.number().nonnegative().optional().default(0),
  packagingChargeType: z.enum(["per_unit", "per_order"]).optional().default("per_unit"),
  discount: z.number().nonnegative().optional().default(0),
  stock: z.number().int().nonnegative("Stock cannot be negative").default(0),
  sku: z.string().min(1, "SKU is required"),
  barcode: z.string().optional().nullable(),
  barcodeSource: z.enum(["auto", "manual", "image"]).optional().default("auto"),
  barcodeImage: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

export const colorVariantSchema = z.object({
  color: z.string().min(1, "Color is required"),
  dimensions: z.string().optional().default(""),
  lengthCm: z.number().nonnegative().nullable().optional().default(null),
  breadthCm: z.number().nonnegative().nullable().optional().default(null),
  heightCm: z.number().nonnegative().nullable().optional().default(null),
  packagingCharge: z.number().nonnegative().optional().default(0),
  packagingChargeType: z.enum(["per_unit", "per_order"]).optional().default("per_unit"),
  images: z.array(z.any()).min(1, "At least 1 image is required for each variant color"),
  subVariants: z.array(subVariantSchema).min(1, "At least 1 sub-variant is required"),
});

export const aPlusBlockSchema = z.object({
  id: z.string(),
  type: z.enum(["text", "image", "image-text", "features"]),
  title: z.string().optional().nullable(),
  content: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  alt: z.string().optional().nullable(),
  features: z.array(z.string()).optional().default([]),
});

export const productSchema = z.object({
  _id: z.string().optional(),
  title: z.string().min(2, "Product title must be at least 2 characters"),
  slug: z.string().min(2, "Product slug must be at least 2 characters"),
  description: z.string().min(10, "Product description must be at least 10 characters"),
  categoryId: z.string().min(1, "Category is required"),
  vendorId: z.string().optional().nullable(),
  rating: z.number().min(0).max(5).default(0),
  reviewCount: z.number().int().nonnegative().default(0),
  tags: z.array(z.string()).optional().default([]),
  cardTags: z.array(z.string()).optional().default([]),
  isActive: z.boolean().default(true),
  totalStock: z.number().int().nonnegative().default(0),
  colorVariants: z.array(colorVariantSchema).optional().default([]),
  aPlusContent: z.array(aPlusBlockSchema).optional().default([]),
  hsnCode: z.string().optional().nullable(),
  gstRate: z.number().nonnegative().optional().nullable(),
  priceIncludesGst: z.boolean().default(true),
  packagingCharge: z.number().nonnegative().optional().default(0),
  packagingChargeType: z.enum(["per_unit", "per_order"]).optional().default("per_unit"),
  defaultPriceTier: z.enum(["B2C", "B2B", "Dropshipping"]).default("B2C"),
  seoTitle: z.string().optional().nullable(),
  seoDescription: z.string().optional().nullable(),
  seoKeywords: z.string().optional().nullable(),
  fieldVisibility: z.object({
    showDescription: z.boolean().default(true),
    showSizes: z.boolean().default(true),
    showWeights: z.boolean().default(true),
    showDimensions: z.boolean().default(true),
    showImages: z.boolean().default(true),
  }).optional(),
  barcode: z.string().optional().nullable(),
  barcodeSource: z.enum(["auto", "manual", "image"]).optional().default("auto"),
  barcodeImage: z.string().optional().nullable(),
});

export const collectionConditionSchema = z.object({
  field: z.enum(["tag", "category", "price", "title", "stock", "vendor"]),
  operator: z.enum(["equals", "not_equals", "contains", "starts_with", "greater_than", "less_than"]),
  value: z.string().min(1, "Condition value is required"),
});

export const collectionRulesSchema = z.object({
  matchType: z.enum(["all", "any"]),
  conditions: z.array(collectionConditionSchema).default([]),
});

export const collectionSchema = z.object({
  title: z.string().min(2, "Title must be at least 2 characters"),
  slug: z.string().min(2, "Slug must be at least 2 characters"),
  description: z.string().optional().nullable(),
  type: z.enum(["manual", "smart"]),
  image: z.string().optional().nullable(),
  bannerImage: z.string().optional().nullable(),
  productIds: z.array(z.string()).optional(),
  rules: collectionRulesSchema.optional().nullable(),
  linkedCategoryIds: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  order: z.number().int().optional(),
  seoTitle: z.string().optional().nullable(),
  seoDescription: z.string().optional().nullable(),
  seoKeywords: z.string().optional().nullable(),
});
