export interface DropshippingPlanOption {
  duration: string; // e.g. "3 Months Plan", "6 Months Plan", "1 Year Plan"
  price: number;   // e.g. 12000, 20000
  originalPrice?: number;
  popular?: boolean;
}

export interface DropshippingPlan {
  id: string;
  name: string;      // e.g. "Gold Plan", "Starter Plan"
  badge?: string;     // e.g. "Most Popular", "Best Value"
  description?: string;
  options: DropshippingPlanOption[];
  features: string[];
  note?: string;
  isActive: boolean;
  order: number;
}

export interface DropshippingBankDetails {
  accountName: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  branch: string;
  accountType: string;
}

export interface DropshippingGSTDetails {
  companyName: string;
  contactName: string;
  displayName: string;
  mobileNumber: string;
  gstNo: string;
  email: string;
  city: string;
  state: string;
}

export interface DropshippingShippingSlab {
  weightSlab: string;
  charge: number;
}

export interface DropshippingTermSection {
  title: string;
  points: string[];
}

export interface DropshippingComparisonRow {
  feature: string;
  traditional: string;
  flexsell: string;
}

export interface DropshippingCMSData {
  hero: {
    badge: string;
    title: string;
    subtitle: string;
    ctaText: string;
    ctaLink: string;
    brochureUrl?: string;
    heroImage?: string;
    stats: { label: string; value: string }[];
  };
  whyFlexsell: {
    heading: string;
    subheading: string;
    bannerImage?: string;
    benefits: {
      id: string;
      title: string;
      description: string;
      icon: string;
      image?: string;
    }[];
  };
  howItWorks: {
    heading: string;
    tagline: string;
    processImage?: string;
    steps: {
      stepNumber: number;
      title: string;
      description: string;
      badge?: string;
      image?: string;
    }[];
  };
  comparison: {
    heading: string;
    subheading: string;
    tagline: string;
    matrixImage?: string;
    rows: DropshippingComparisonRow[];
  };
  pricing: {
    heading: string;
    subheading: string;
    bannerImage?: string;
    plans: DropshippingPlan[];
    categories: string[];
  };
  bankDetails: DropshippingBankDetails;
  gstDetails: DropshippingGSTDetails;
  shippingRates: {
    heading: string;
    subheading: string;
    slabs: DropshippingShippingSlab[];
    pickPackNote: string;
  };
  terms: {
    heading: string;
    subheading: string;
    sections: DropshippingTermSection[];
  };
}

export const initialDropshippingCMSData: DropshippingCMSData = {
  hero: {
    badge: "DROPSHIPPING 2026",
    title: "Start Your Amazon Business With Zero Inventory Risk",
    subtitle: "More Sales. Less Risk. Zero Inventory Investment. Running an Amazon business traditionally requires heavy investment, inventory planning, product sourcing, warehousing, and logistics. FlexSell eliminates these barriers so you can start selling with confidence.",
    ctaText: "Apply as Dropshipper Partner",
    ctaLink: "#register-form",
    brochureUrl: "/docs/FLEXSELL_DROPSHIPPING_2026.pdf",
    heroImage: "/images/dropshipping/image1.png",
    stats: [
      { label: "Inventory Investment", value: "₹0" },
      { label: "Warehouse Storage Needed", value: "0 Sq Ft" },
      { label: "Dispatched from Bhopal", value: "100% Managed" },
      { label: "Handling Time", value: "3 Business Days" }
    ]
  },
  whyFlexsell: {
    heading: "Why Thousands of Sellers Are Moving Towards Smarter Selling",
    subheading: "FlexSell provides a turnkey solution that handles inventory, catalog research, warehousing, and order fulfillment directly from our Bhopal hub.",
    bannerImage: "/images/dropshipping/image2.png",
    benefits: [
      {
        id: "b1",
        title: "Zero Upfront Inventory Investment",
        description: "Start selling without buying stock in advance. Your capital stays available for business growth.",
        icon: "dollar",
        image: "/images/dropshipping/image27.jpeg"
      },
      {
        id: "b2",
        title: "No Inventory Purchase",
        description: "FlexSell already maintains product inventory. You don't need to purchase or store products.",
        icon: "box",
        image: "/images/dropshipping/image26.jpeg"
      },
      {
        id: "b3",
        title: "No Product Research Needed",
        description: "Gain access to high-margin, trending products curated specifically for Amazon sellers.",
        icon: "search"
      },
      {
        id: "b4",
        title: "No Warehouse Required",
        description: "Eliminate storage space and facility costs. All products are safely stored in our Bhopal facility.",
        icon: "warehouse"
      },
      {
        id: "b5",
        title: "Order Fulfillment Managed",
        description: "We handle complete packing, labeling, and dispatch of orders directly to your customers.",
        icon: "truck",
        image: "/images/dropshipping/image33.jpeg"
      },
      {
        id: "b6",
        title: "Pay Only When You Receive an Order",
        description: "Purchase products from us only after receiving a confirmed order from your customer.",
        icon: "shield"
      }
    ]
  },
  howItWorks: {
    heading: "How FlexSell Dropshipping Works",
    tagline: "5 SIMPLE STEPS TO SCALE YOUR AMAZON BUSINESS",
    processImage: "/images/dropshipping/image3.png",
    steps: [
      {
        stepNumber: 1,
        title: "JOIN FLEXSELL WHOLESALE DROPSHIPPING PROGRAM",
        description: "Register with FlexSell Wholesale and subscribe to our Dropshipping Gold Membership Plan to get access to our high-margin product catalog and automated fulfillment services.",
        badge: "STEP 1: REGISTRATION"
      },
      {
        stepNumber: 2,
        title: "PRODUCT LISTING (5-6 PRODUCTS / MONTH)",
        description: "FlexSell Wholesale provides 5 to 6 curated, high-demand products every month. You list these products on your Amazon seller account using optimized listing information provided by our team.",
        badge: "STEP 2: LISTING"
      },
      {
        stepNumber: 3,
        title: "CUSTOMER PLACES AN ORDER ON AMAZON",
        description: "When a customer purchases a product from your Amazon storefront, you receive the full payment directly from Amazon into your seller account.",
        badge: "STEP 3: ORDER RECEIVED"
      },
      {
        stepNumber: 4,
        title: "PAY ONLY FOR ORDERED PRODUCTS",
        description: "You transfer the order details to FlexSell Wholesale and pay only the wholesale product price + shipping charge using your FlexSell Advance Balance.",
        badge: "STEP 4: ORDER TRANSFER"
      },
      {
        stepNumber: 5,
        title: "PACKING & SHIPPING BY FLEXSELL WHOLESALE",
        description: "FlexSell Wholesale picks, packs, and dispatches the order within 24-48 business hours directly to your customer's delivery address, providing real-time tracking.",
        badge: "STEP 5: DISPATCH"
      }
    ]
  },
  comparison: {
    heading: "TRADITIONAL AMAZON BUSINESS VS FLEXSELL WHOLESALE",
    subheading: "TRADITIONAL MODEL VS FLEXSELL MODEL",
    tagline: "SMARTER SELLING MODEL FOR AMAZON GROWTH",
    matrixImage: "/images/dropshipping/image4.png",
    rows: [
      {
        feature: "Upfront Capital Required",
        traditional: "High (Bulk Inventory Purchase Required)",
        flexsell: "Zero (Pay Only Per Order)"
      },
      {
        feature: "Unsold Stock Risk",
        traditional: "High Risk (Dead Stock Losses)",
        flexsell: "Zero Risk (No Pre-purchased Stock)"
      },
      {
        feature: "Warehouse & Storage Costs",
        traditional: "Monthly Storage / FBA Fees",
        flexsell: "₹0 Storage Costs (Stored in Bhopal Facility)"
      },
      {
        feature: "Product Research Effort",
        traditional: "Tedious & High Failure Rate",
        flexsell: "Curated High-Demand Winners Provided"
      },
      {
        feature: "Packing & Dispatch Labor",
        traditional: "Manual Packing / FBA Inbound Hassle",
        flexsell: "100% Handled by FlexSell (24h Dispatch)"
      },
      {
        feature: "Cash Flow Safety",
        traditional: "Locked up in Dead Stock",
        flexsell: "Liquid & Highly Scalable"
      },
      {
        feature: "Handling Time",
        traditional: "2–4 Days",
        flexsell: "Within 24-48 Hours"
      },
      {
        feature: "Shipping Rate Optimization",
        traditional: "High Retail Courier Charges",
        flexsell: "Pre-negotiated Bulk Courier Rates (from ₹55)"
      },
      {
        feature: "Damaged / RTO Support",
        traditional: "Self-borne Loss",
        flexsell: "Dedicated Claim & RTO Assistance"
      }
    ]
  },
  pricing: {
    heading: "MEMBERSHIP PLAN & PRICING",
    subheading: "GOLD MEMBERSHIP PLAN — COMPLETE AUTOMATED FULFILLMENT",
    bannerImage: "/images/dropshipping/image7.jpeg",
    plans: [
      {
        id: "gold-plan",
        name: "Gold Plan",
        badge: "Most Popular",
        description: "Complete hands-off dropshipping program for Amazon sellers.",
        options: [
          {
            duration: "3 Months Plan",
            price: 12000,
            originalPrice: 15000,
            popular: false
          },
          {
            duration: "6 Months Plan",
            price: 20000,
            originalPrice: 24000,
            popular: true
          }
        ],
        features: [
          "5-6 Curated High-Margin Products Listed Monthly",
          "Bhopal 40,000 Sq Ft Warehouse Storage & Packing",
          "Real-time Tracking & Amazon Integration",
          "Dedicated Account Manager Assistance",
          "Zero Inventory Storage Fees"
        ],
        note: "Subscription fees are non-refundable once activated.",
        isActive: true,
        order: 1
      }
    ],
    categories: [
      "Home & Kitchen",
      "Home Decor",
      "Home Improvement",
      "Bathroom Accessories",
      "Small Appliances",
      "Health & Personal Care"
    ]
  },
  bankDetails: {
    accountName: "CONTINENTAL MERCANTILE ECOMMERCE GROUP",
    bankName: "AXIS BANK",
    accountNumber: "924020023471011",
    ifscCode: "UTIB0003463",
    branch: "PEERGATE BRANCH, BHOPAL",
    accountType: "Current Account"
  },
  gstDetails: {
    companyName: "CONTINENTAL MERCANTILE ECOMMERCE GROUP",
    contactName: "FlexSell Business Support",
    displayName: "FLEXSELL WHOLESALE",
    mobileNumber: "+91 98765 43210",
    gstNo: "23ABBPQ0103G1ZG",
    email: "support@flexsellwholesale.com",
    city: "Bhopal",
    state: "Madhya Pradesh"
  },
  shippingRates: {
    heading: "PAN-INDIA SHIPPING CHARGES & WEIGHT SLABS",
    subheading: "COMPETITIVE BULK LOGISTICS COURIER RATES",
    slabs: [
      { weightSlab: "0g - 500g", charge: 55 },
      { weightSlab: "501g - 1000g (1 kg)", charge: 75 },
      { weightSlab: "1001g - 2000g (2 kg)", charge: 112 }
    ],
    pickPackNote: "Pick & Pack Charge: ₹15 per order | Handling Time: Orders dispatched within 24-48 business hours."
  },
  terms: {
    heading: "FLEXSELL WHOLESALE DROPSHIPPING TERMS & CONDITIONS",
    subheading: "PLEASE READ THESE TERMS AND CONDITIONS CAREFULLY BEFORE JOINING THE FLEXSELL WHOLESALE DROPSHIPPING PROGRAM.",
    sections: [
      {
        title: "1. PROGRAM OVERVIEW",
        points: [
          "FlexSell Wholesale provides a B2B Dropshipping Service for Amazon sellers.",
          "Under this program, FlexSell Wholesale manages product sourcing, inventory storage, order packing, and shipping on behalf of the client.",
          "The client lists products on their own Amazon seller account and receives orders directly from customers."
        ]
      },
      {
        title: "2. SUBSCRIPTION & MEMBERSHIP FEES",
        points: [
          "To access the dropshipping program, clients must subscribe to the Gold Membership Plan.",
          "Subscription Options: 3 Months Plan (₹12,000) or 6 Months Plan (₹20,000).",
          "Subscription fees are non-refundable under any circumstances once the service has started."
        ]
      },
      {
        title: "3. PRODUCT LISTING & INVENTORY MANAGEMENT",
        points: [
          "FlexSell Wholesale will provide 5 to 6 curated products per month for listing on the client's Amazon account.",
          "Product selection is based on market demand, catalog feasibility, and profitability.",
          "FlexSell Wholesale maintains physical inventory in its warehouse facilities."
        ]
      },
      {
        title: "4. ORDER PROCESSING & PAYMENT TERMS",
        points: [
          "All dropshipping orders are processed strictly on a prepaid basis.",
          "Clients must maintain sufficient balance in their FlexSell account or pay for each order before dispatch.",
          "Dispatch Handling Time: Orders are processed and dispatched within 24 to 48 business hours after payment confirmation."
        ]
      },
      {
        title: "5. SHIPPING & LOGISTICS CHARGES",
        points: [
          "Shipping charges are applied based on product weight slabs (0-500g: ₹55, 501g-1kg: ₹75, 1kg-2kg: ₹112).",
          "A fixed Pick & Pack charge of ₹15 per order applies.",
          "Logistics services are fulfilled through third-party courier partners."
        ]
      },
      {
        title: "6. RETURN (RTO) POLICY",
        points: [
          "Any Return-to-Origin (RTO) or customer return will not be the responsibility of FlexSell Wholesale.",
          "All returned products will be delivered directly to the client's registered return address.",
          "FlexSell Wholesale will not store, reship, or reschedule returned products."
        ]
      },
      {
        title: "7. DAMAGED RETURN SUPPORT",
        points: [
          "If a returned product is received in damaged condition, our team will assist you in raising a claim with Amazon or the respective courier partner.",
          "Claim approval is entirely subject to Amazon/courier policies and discretion.",
          "FlexSell Wholesale does not guarantee claim approval or compensation."
        ]
      },
      {
        title: "8. RE-SHIPPING OF RETURNED PRODUCTS",
        points: [
          "If the returned product is received in good condition, you may re-dispatch the product using Amazon EasyShip or any other shipping service of your choice."
        ]
      },
      {
        title: "9. CLIENT RESPONSIBILITIES",
        points: [
          "Maintain sufficient Advance Balance or make advance payment for order processing.",
          "Ensure timely payment for all orders to avoid dispatch delays.",
          "Accept applicable product prices, shipping charges, Pick & Pack charges, and GST.",
          "Accept responsibility for all returned (RTO) products.",
          "Cooperate with FlexSell Wholesale for any additional information or documentation if required."
        ]
      },
      {
        title: "10. FLEXSELL WHOLESALE RESPONSIBILITIES",
        points: [
          "Manage client's Amazon account and process orders.",
          "Pack products securely and ensure timely dispatch.",
          "Upload tracking information on Amazon.",
          "Provide claim assistance for damaged returns wherever applicable.",
          "Coordinate all operational activities for smooth order fulfillment."
        ]
      }
    ]
  }
};

export const DEFAULT_DROPSHIPPING_CMS = initialDropshippingCMSData;
