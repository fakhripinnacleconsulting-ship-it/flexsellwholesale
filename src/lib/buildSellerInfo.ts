import { SellerInfo } from "@/types";

/**
 * Constructs a standardized SellerInfo object from CMS data.
 *
 * Centralizes the seller/company information extraction so that every document
 * call-site (admin orders, client orders, order-confirmation) uses the same
 * logic — including Company Legal Entity Name, bank details, and T&C.
 */
export function buildSellerInfo(cmsData: any): SellerInfo {
  const bs = cmsData?.businessSettings;
  const br = cmsData?.brandSettings;

  return {
    storeName: bs?.storeName || br?.storeName || "FlexSell Wholesale",
    legalName: bs?.legalName || "FlexSell Wholesale Sourcing Pvt Ltd",
    gstin: bs?.gstin || br?.gstin || "24AAACF1001M1Z5",
    address: bs?.companyAddress
      ? `${bs.companyAddress}, ${bs.city || ""}, ${bs.state || ""} - ${bs.pinCode || ""}`
      : br?.companyAddress || "Plot No. 12, GIDC Industrial Estate, Sachin, Bhopal, Madhya Pradesh - 394230",
    email: bs?.supportEmail || br?.supportEmail || "support@flexsellwholesale.in",
    phone: bs?.supportPhone || br?.supportPhone || "+91 88877 66655",
    signatureUrl: bs?.signatureUrl,
    bankDetails: bs?.bankName
      ? {
          bankName: bs.bankName,
          accountName: bs.accountName,
          accountNumber: bs.accountNumber,
          ifscCode: bs.ifscCode,
          branchName: bs.branchName,
        }
      : undefined,
    termsAndConditions: bs?.termsAndConditions,
  };
}
