"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { CheckCircle2, ArrowRight, Send } from "lucide-react";
import { useToastStore } from "@/stores/toastStore";
import { DropshippingBusinessSection } from "@/components/storefront/DropshippingBusinessSection";
import { TestimonialsSection } from "@/components/storefront/TestimonialsSection";

interface DropshipPageContent {
  badge?: string;
  heroHeading?: string;
  heroSubheading?: string;
  ctaText?: string;
  formBadge?: string;
  formHeading?: string;
  formSubheading?: string;
  orderVolumeOptions?: string[];
}

export default function DropshippingPage() {
  const { addToast } = useToastStore();
  const [pageContent, setPageContent] = React.useState<DropshipPageContent | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSubmitted, setIsSubmitted] = React.useState(false);

  // Form State
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [company, setCompany] = React.useState("");
  const [expectedOrders, setExpectedOrders] = React.useState("10-50 orders/day");
  const [message, setMessage] = React.useState("");

  React.useEffect(() => {
    fetch("/api/cms")
      .then((res) => res.json())
      .then((data) => {
        if (data.dropshipping_page_content) {
          setPageContent(data.dropshipping_page_content);
          if (data.dropshipping_page_content.orderVolumeOptions?.length > 0) {
            setExpectedOrders(data.dropshipping_page_content.orderVolumeOptions[0]);
          }
        }
      })
      .catch((err) => console.error("Error loading dropship page content:", err));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !lastName || !email || !phone) {
      addToast("Please fill in all required fields", "warning");
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: "dropshipping",
          firstName,
          lastName,
          email,
          phone,
          company,
          subject: `Dropshipping Partner Application - ${company || firstName}`,
          message: message || `Application for dropshipping program. Expected volume: ${expectedOrders}`,
          expectedOrders
        })
      });

      if (!res.ok) throw new Error("Failed to submit application");

      setIsSubmitted(true);
      addToast("Dropshipper application submitted successfully! Our team will contact you within 24 hours.", "success");
    } catch (err: unknown) {
      addToast((err as any).message || "Failed to submit application", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const badge = pageContent?.badge || "Independent Dropshipping Channel";
  const heroHeading = pageContent?.heroHeading || "Automated Dropshipping Program With Zero Inventory Risk";
  const heroSubheading = pageContent?.heroSubheading || "Sell thousands of trending consumer gadgets directly to your retail buyers. We store, quality check, and white-label dispatch directly from our Surat hub.";
  const ctaText = pageContent?.ctaText || "Apply as Dropshipper Partner";
  const formBadge = pageContent?.formBadge || "Partner Onboarding";
  const formHeading = pageContent?.formHeading || "Apply for Dropshipper Access";
  const formSubheading = pageContent?.formSubheading || "Fill in your business details below to request white-label dropship pricing privileges & API keys.";
  const volumeOptions = pageContent?.orderVolumeOptions || [
    "1 - 10 orders/day",
    "10 - 50 orders/day",
    "50 - 200 orders/day",
    "200+ orders/day"
  ];

  return (
    <div className="flex flex-col gap-12 pb-16 text-foreground">
      {/* Dynamic Hero Section */}
      <section className="bg-gradient-to-b from-purple-500/10 via-background to-background py-16 md:py-20 border-b">
        <div className="container mx-auto px-4 max-w-5xl text-center space-y-6">
          <span className="bg-purple-500/20 text-purple-700 dark:text-purple-300 px-4 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-wider inline-block">
            {badge}
          </span>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight leading-tight">
            {heroHeading}
          </h1>
          <p className="text-base md:text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            {heroSubheading}
          </p>
          <div className="flex justify-center gap-4 pt-4">
            <a href="#register-form">
              <Button size="lg" className="font-bold shadow-lg gap-2 shrink-0 bg-purple-600 hover:bg-purple-700 text-white cursor-pointer">
                {ctaText} <ArrowRight className="h-4 w-4" />
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Independent Dropshipping Business Cards Section */}
      <DropshippingBusinessSection />

      {/* Independent Dropshipper Testimonials */}
      <TestimonialsSection
        title="Dropship Partner Stories"
        subtitle="Hear from e-commerce store owners scaling with FlexSell white-label fulfillment."
        type="dropshipper"
      />

      {/* Registration Form Section */}
      <section id="register-form" className="container mx-auto px-4 max-w-3xl scroll-mt-24">
        <Card className="border shadow-lg">
          <CardHeader className="text-center space-y-2">
            <span className="text-xs font-bold uppercase text-purple-600 tracking-widest">{formBadge}</span>
            <CardTitle className="text-2xl md:text-3xl font-extrabold">{formHeading}</CardTitle>
            <p className="text-sm text-muted-foreground">{formSubheading}</p>
          </CardHeader>

          <CardContent className="pt-4">
            {isSubmitted ? (
              <div className="p-8 text-center space-y-4 bg-purple-500/5 rounded-xl border border-purple-500/20">
                <CheckCircle2 className="h-12 w-12 text-purple-600 mx-auto" />
                <h3 className="text-xl font-bold text-foreground">Application Received!</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Thank you for applying to the FlexSell Dropshipping Program. Our account executive will review your application and send API & login credentials to <strong>{email}</strong> within 24 business hours.
                </p>
                <Button onClick={() => setIsSubmitted(false)} variant="outline" size="sm">
                  Submit another application
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold">First Name *</label>
                    <Input placeholder="John" value={firstName} onChange={(e) => setFirstName(e.target.value)} required disabled={isSubmitting} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold">Last Name *</label>
                    <Input placeholder="Doe" value={lastName} onChange={(e) => setLastName(e.target.value)} required disabled={isSubmitting} />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold">Email Address *</label>
                    <Input type="email" placeholder="john@store.com" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={isSubmitting} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold">Phone / WhatsApp Number *</label>
                    <Input type="tel" placeholder="+91 98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} required disabled={isSubmitting} />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold">Store / Brand Name</label>
                    <Input placeholder="MyShop E-Commerce" value={company} onChange={(e) => setCompany(e.target.value)} disabled={isSubmitting} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold">Expected Daily Orders</label>
                    <select
                      value={expectedOrders}
                      onChange={(e) => setExpectedOrders(e.target.value)}
                      className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary"
                      disabled={isSubmitting}
                    >
                      {volumeOptions.map((opt, i) => (
                        <option key={i} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold">Additional Message or Store Link</label>
                  <textarea
                    rows={3}
                    placeholder="Tell us about your e-commerce store or product categories you are interested in..."
                    className="w-full p-3 text-sm rounded-md border border-input bg-background focus:ring-2 focus:ring-primary"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>

                <Button type="submit" className="w-full font-bold gap-2 bg-purple-600 hover:bg-purple-700 text-white cursor-pointer" size="lg" disabled={isSubmitting}>
                  <Send className="h-4 w-4" /> {isSubmitting ? "Submitting Application..." : "Submit Dropshipping Application"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
