export interface PolicySection {
  heading: string;
  text: string;
}

export const pagesContent = {
  policies: {
    privacy: {
      title: "Corporate Privacy Policy",
      lastUpdated: "June 12, 2024",
      sections: [
        {
          heading: "1. Scope of Data Gathering",
          text: "We gather business credentials, shipping addresses, GST certificates, and contact details to verify authenticity and streamline wholesale invoicing."
        },
        {
          heading: "2. Data Protection Standards",
          text: "All sensitive payment credentials are encrypted using industry-standard AES-256 protocols. Your trade secrets and supplier details remain confidential."
        }
      ]
    },
    terms: {
      title: "B2B Terms of Service",
      lastUpdated: "June 12, 2024",
      sections: [
        {
          heading: "1. Retail Reselling Authorizations",
          text: "Buyers warrant that they are registered businesses purchasing goods for commercial resale or manufacturing purposes, not personal consumption."
        },
        {
          heading: "2. Account Suspension Thresholds",
          text: "We reserve the right to cancel accounts and restrict wholesale pricing for buyers providing fraudulent business IDs or repeatedly returning bulk orders."
        }
      ]
    },
    shipping: {
      title: "Freight & Shipping Policies",
      lastUpdated: "June 12, 2024",
      sections: [
        {
          heading: "1. Dispatch Timelines",
          text: "Bulk wholesale orders are packed and dispatched from our Surat warehouse within 24-48 working hours. Heavy cargo shipping times range from 3-7 days."
        },
        {
          heading: "2. Remote Region Cargo Surcharges",
          text: "Special transport charges may apply for heavy freight going to Northeast states, J&K, and deep rural regions. Surcharges will be quoted by phone if needed."
        }
      ]
    },
    return: {
      title: "Bulk Return & Refund Policies",
      lastUpdated: "June 12, 2024",
      sections: [
        {
          heading: "1. Zero Unsold Returns",
          text: "Because we run at minimal margins, we do not accept returns for unsold goods or change-of-mind situations. All wholesale sales are final."
        },
        {
          heading: "2. Transit Defect Claims",
          text: "A continuous, uncut video showing the opening of the cargo box is mandatory to process shipping transit damage claims. Approved claims receive wallet top-up credits."
        }
      ]
    }
  }
};
