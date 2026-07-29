"use client";

import * as React from "react";
import { initialDropshippingCMSData, DropshippingCMSData } from "@/lib/seedDropshippingCMS";
import { DropshippingHero } from "@/components/dropshipping/DropshippingHero";
import { DropshippingWhySection } from "@/components/dropshipping/DropshippingWhySection";
import { DropshippingHowItWorks } from "@/components/dropshipping/DropshippingHowItWorks";
import { DropshippingComparisonTable } from "@/components/dropshipping/DropshippingComparisonTable";
import { DropshippingPricingPlans } from "@/components/dropshipping/DropshippingPricingPlans";
import { DropshippingBankAndGST } from "@/components/dropshipping/DropshippingBankAndGST";
import { DropshippingShippingRates } from "@/components/dropshipping/DropshippingShippingRates";
import { DropshippingTermsAccordion } from "@/components/dropshipping/DropshippingTermsAccordion";
import { DropshippingRegisterForm } from "@/components/dropshipping/DropshippingRegisterForm";
import { TestimonialsSection } from "@/components/storefront/TestimonialsSection";

export function DropshippingView() {
  const [cmsData, setCmsData] = React.useState<DropshippingCMSData>(initialDropshippingCMSData);
  const [selectedPlan, setSelectedPlan] = React.useState<string>("");

  React.useEffect(() => {
    fetch("/api/cms")
      .then((res) => res.json())
      .then((data) => {
        if (data.dropshipping_cms) {
          setCmsData((prev) => ({
            ...prev,
            ...data.dropshipping_cms,
          }));
        }
      })
      .catch((err) => {
        console.error("Failed to fetch dropshipping CMS content:", err);
      });
  }, []);

  const scrollToRegister = () => {
    const el = document.getElementById("register-form");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleSelectPlan = (planName: string) => {
    setSelectedPlan(planName);
    scrollToRegister();
  };

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      {/* 1. Hero Section */}
      <DropshippingHero data={cmsData.hero} onRegisterClick={scrollToRegister} />

      {/* 2. Core Benefits Section */}
      <DropshippingWhySection data={cmsData.whyFlexsell} />

      {/* 3. How It Works 5-Step Process */}
      <DropshippingHowItWorks data={cmsData.howItWorks} />

      {/* 4. Comparison Table (Traditional Amazon vs FlexSell) */}
      <DropshippingComparisonTable data={cmsData.comparison} />

      {/* 5. Dynamic Pricing Plans & Supported Categories */}
      <DropshippingPricingPlans data={cmsData.pricing} onSelectPlan={handleSelectPlan} />

      {/* 6. AXIS Bank & GST Verification Details */}
      <DropshippingBankAndGST data={cmsData} />

      {/* 7. Pan-India Shipping Slabs */}
      <DropshippingShippingRates data={cmsData.shippingRates} />

      {/* 8. Partner Testimonials */}
      <TestimonialsSection
        title="Dropship Partner Stories"
        subtitle="Hear from Amazon sellers scaling with FlexSell 100% managed inventory."
        type="dropshipper"
      />

      {/* 9. Terms & Conditions Policy Accordion */}
      <DropshippingTermsAccordion data={cmsData.terms} />

      {/* 10. Partner Onboarding Application Form */}
      <DropshippingRegisterForm selectedPlan={selectedPlan} plans={cmsData.pricing?.plans} />
    </div>
  );
}
