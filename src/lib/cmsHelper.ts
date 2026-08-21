export const defaultPolicies = {
  privacy: {
    title: "Corporate Privacy Policy",
    lastUpdated: "2026-07-27",
    content: `<h3>1. Scope of Data Gathering</h3><p>We gather business credentials, shipping addresses, GST certificates, and contact details to verify authenticity and streamline wholesale invoicing.</p><h3>2. Data Protection Standards</h3><p>All sensitive payment credentials are encrypted using industry-standard AES-256 protocols. Your trade secrets and supplier details remain confidential.</p>`,
  },
  terms: {
    title: "B2B Terms of Service",
    lastUpdated: "2026-07-27",
    content: `<h3>1. Retail Reselling Authorizations</h3><p>Buyers warrant that they are registered businesses purchasing goods for commercial resale or manufacturing purposes, not personal consumption.</p><h3>2. Account Suspension Thresholds</h3><p>We reserve the right to cancel accounts and restrict wholesale pricing for buyers providing fraudulent business IDs or repeatedly returning bulk orders.</p>`,
  },
  shipping: {
    title: "Freight & Shipping Policies",
    lastUpdated: "2026-07-27",
    content: `<h3>1. Dispatch Timelines</h3><p>Bulk wholesale orders are packed and dispatched from our Bhopal warehouse within 24-48 working hours. Heavy freight shipping times range from 3-7 days.</p><h3>2. Remote Region Logistics Surcharges</h3><p>Special transport charges may apply for heavy freight going to Northeast states, J&K, and deep rural regions. Surcharges will be quoted by phone if needed.</p>`,
  },
  return: {
    title: "Bulk Return & Refund Policies",
    lastUpdated: "2026-07-27",
    content: `<h3>1. Zero Unsold Returns</h3><p>Because we run at minimal margins, we do not accept returns for unsold goods or change-of-mind situations. All wholesale sales are final.</p><h3>2. Transit Defect Claims</h3><p>A continuous, uncut video showing the opening of the parcel package is mandatory to process shipping transit damage claims. Approved claims receive Advance Balance top-up credits.</p>`,
  },
};

export const defaultBlogs = [
  {
    title: "10 Wholesale Trends Shaping Indian B2B E-commerce in 2026",
    slug: "wholesale-b2b-trends-2026",
    category: "Industry News",
    author: "FlexSell Research Team",
    excerpt: "Discover how direct-from-manufacturer sourcing, automated MOQ tier pricing, and instant GST invoicing are transforming wholesale distribution in India.",
    content: `<h2>1. Direct Manufacturer Sourcing</h2><p>Indian B2B buyers are moving away from multi-tier regional distributors toward direct factory sourcing to capture maximum gross margins.</p><h2>2. Automated Tier Pricing & Tiered MOQs</h2><p>Dynamic tier pricing allows resellers to order smaller trial quantities while unlocking deep wholesale discounts as volume scales.</p>`,
    coverImage: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1200&q=80",
    readTime: "4 min read",
    publishedAt: new Date().toISOString(),
    isActive: true
  },
  {
    title: "How to Build a High-Margin Dropshipping Business with Zero Inventory",
    slug: "high-margin-dropshipping-guide",
    category: "Dropshipping",
    author: "FlexSell Trade Team",
    excerpt: "Learn how to launch your branded online store using white-label shipping, verified supplier stocks, and fast 48-hour delivery across India.",
    content: `<h2>Zero Capital Risk</h2><p>Dropshipping empowers digital entrepreneurs to sell premium household and electronics products without tying up capital in inventory warehousing.</p><h2>White-Label Packaging</h2><p>Deliver orders under your own brand identity with custom invoice headers and unbranded shipping boxes.</p>`,
    coverImage: "https://images.unsplash.com/photo-1556742049-0a67daf64f42?auto=format&fit=crop&w=1200&q=80",
    readTime: "5 min read",
    publishedAt: new Date().toISOString(),
    isActive: true
  }
];

export const defaultBusinessSettings = {
  storeName: "FlexSell Wholesale",
  legalName: "FlexSell Wholesale Sourcing Pvt Ltd",
  gstin: "24AAACF1001M1Z5",
  pan: "AAACF1001M",
  cin: "U51909MP2024PTC012345",
  companyAddress: "Plot No. 12, GIDC Industrial Estate, Sachin",
  city: "Bhopal",
  state: "Madhya Pradesh",
  pinCode: "394230",
  supportEmail: "support@flexsellwholesale.com",
  supportPhone: "+91 88877 66655",
  websiteUrl: "https://flexsellwholesale.com",
  timings: "9:30 AM to 6:30 PM (Sunday Closed)",
  signatureUrl: "",
  bankName: "HDFC Bank",
  accountName: "FlexSell B2B Private Limited",
  accountNumber: "50200084729104",
  ifscCode: "HDFC0000024",
  branchName: "Sachin GIDC, Bhopal",
  termsAndConditions: [
    "All invoices are subject to Bhopal jurisdiction only.",
    "Interest @ 18% p.a. will be charged on payments delayed beyond agreed credit SLAs.",
    "Physical inspection of delivered packages must be reported within 24 hours of arrival.",
    "GST E-Way Bill details are generated directly via API for verified B2B transport."
  ]
};

export const defaultHomepageHeadings = {
  categoriesTitle: "Shop Top Product Categories",
  categoriesSubtitle: "Direct factory products sourced at lowest wholesale rates from Central India.",
  collectionsTitle: "Special Sourcing Lines & Collections",
  collectionsSubtitle: "Handpicked winning products ready for bulk order procurement.",
  trendingTitle: "Fast Selling Consumer Products",
  trendingSubtitle: "Our highest demand products selling fast across Indian retail shops.",
  newArrivalsTitle: "Fresh Stock & New Arrivals",
  newArrivalsSubtitle: "Latest wholesale stock items added to our warehouse this week.",
  recommendedTitle: "Recommended Products for Your Store",
  testimonialsTitle: "What Our Retailers & Partners Say",
  testimonialsSubtitle: "Real reviews from shopkeepers, online sellers, and dropship partners across India.",
};

export const defaultHomepageSettings = {
  showHeroBanners: true,
  showTrustBar: true,
  showCategories: true,
  showFeaturedCollections: true,
  showWholesaleBiz: true,
  showTrendingProducts: true,
  showNewArrivals: true,
  showDropshipBiz: true,
  showBrandPartners: true,
  showRecommendedProducts: true,
  showTestimonials: true,
};

export const defaultHomepageSeo = {
  seoTitle: "FlexSell Wholesale | Direct Factory Wholesale Sourcing Platform India",
  seoDescription: "Buy bulk wholesale products at lowest factory rates direct from Bhopal Central Warehouse. Fast dispatch, GST invoice, and zero-inventory dropshipping.",
  seoKeywords: "wholesale market Bhopal, B2B wholesale India, factory rate products, dropshipping supplier, bulk buy online",
  ogImageUrl: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1200&q=80",
};
