"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Mail, Phone, MapPin, Send, CheckCircle2, Clock, Building2, Globe, Share2 } from "lucide-react";
import { useToastStore } from "@/stores/toastStore";
import { apiClient } from "@/lib/apiClient";
import { defaultBusinessSettings } from "@/lib/cmsHelper";

export function ContactView() {
  const { addToast } = useToastStore();

  const [companyInfo, setCompanyInfo] = React.useState({
    storeName: defaultBusinessSettings.storeName,
    legalName: defaultBusinessSettings.legalName,
    gstin: defaultBusinessSettings.gstin,
    companyAddress: defaultBusinessSettings.companyAddress,
    city: defaultBusinessSettings.city,
    state: defaultBusinessSettings.state,
    pinCode: defaultBusinessSettings.pinCode,
    supportEmail: defaultBusinessSettings.supportEmail,
    supportPhone: defaultBusinessSettings.supportPhone,
    websiteUrl: defaultBusinessSettings.websiteUrl,
    timings: defaultBusinessSettings.timings,
  });

  const [socialLinks, setSocialLinks] = React.useState<{ id: string; name: string; url: string; iconUrl?: string }[]>([]);

  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [subject, setSubject] = React.useState("Bulk Sourcing Quote");
  const [message, setMessage] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSubmitted, setIsSubmitted] = React.useState(false);

  React.useEffect(() => {
    const fetchCmsData = async () => {
      try {
        const data = await apiClient.get<any>("/cms");
        if (data?.businessSettings) {
          setCompanyInfo((prev) => ({ ...prev, ...data.businessSettings }));
        }
        if (data?.footerSettings?.socialLinks) {
          setSocialLinks(data.footerSettings.socialLinks);
        }
      } catch (err) {
        console.error("Failed to load CMS contact details:", err);
      }
    };
    fetchCmsData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !lastName || !email || !message) {
      addToast("Please fill in all required fields", "warning");
      return;
    }

    let category: "wholesale" | "dropshipping" | "support" | "franchise" | "general" = "general";
    if (subject.includes("Bulk") || subject.includes("Quote")) category = "wholesale";
    else if (subject.includes("Dropshipping")) category = "dropshipping";
    else if (subject.includes("Franchise")) category = "franchise";
    else if (subject.includes("Damaged") || subject.includes("Delay") || subject.includes("Claim")) category = "support";

    try {
      setIsSubmitting(true);
      const res = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          firstName,
          lastName,
          email,
          subject,
          message
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to submit inquiry");
      }

      setIsSubmitted(true);
      addToast("Inquiry submitted successfully! Our support team will respond shortly.", "success");
    } catch (err: unknown) {
      addToast((err as any).message || "Failed to submit inquiry", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const fullAddress = `${companyInfo.companyAddress}, ${companyInfo.city}, ${companyInfo.state} - ${companyInfo.pinCode}`;

  return (
    <div className="container mx-auto px-4 py-12 max-w-6xl text-foreground">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-extrabold tracking-tight mb-4">Contact {companyInfo.storeName} Support</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Got bulk inquiries, custom shipping concerns, or looking to schedule a warehouse visit? Reach out directly.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-12 items-start">
        {/* Contact Info Cards */}
        <div className="space-y-6">
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <CardTitle className="text-xl font-bold">Corporate Contact Details</CardTitle>
                {companyInfo.gstin && (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-primary/10 text-primary border border-primary/20">
                    GSTIN: {companyInfo.gstin}
                  </span>
                )}
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Corporate Legal Name */}
              <div className="flex gap-4">
                <div className="bg-primary/10 p-3 rounded-full h-fit shrink-0">
                  <Building2 className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold">Legal Corporate Entity</h3>
                  <p className="text-sm font-medium text-foreground mt-0.5">{companyInfo.legalName}</p>
                </div>
              </div>

              {/* Warehouse Address */}
              <div className="flex gap-4">
                <div className="bg-primary/10 p-3 rounded-full h-fit shrink-0">
                  <MapPin className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold">Central Logistics Hub & Warehouse</h3>
                  <p className="text-sm text-muted-foreground mt-1">{fullAddress}</p>
                </div>
              </div>

              {/* B2B Support Phone */}
              <div className="flex gap-4">
                <div className="bg-primary/10 p-3 rounded-full h-fit shrink-0">
                  <Phone className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold"> Support</h3>
                  <p className="text-sm font-semibold text-foreground mt-1">{companyInfo.supportPhone}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Clock className="h-3 w-3" /> {companyInfo.timings}
                  </p>
                </div>
              </div>

              {/* Corporate Email */}
              <div className="flex gap-4">
                <div className="bg-primary/10 p-3 rounded-full h-fit shrink-0">
                  <Mail className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold">Official Corporate Email</h3>
                  <a href={`mailto:${companyInfo.supportEmail}`} className="text-sm font-mono text-primary hover:underline mt-1 block">
                    {companyInfo.supportEmail}
                  </a>
                  <p className="text-xs text-muted-foreground">Response SLA: 4-6 business hours</p>
                </div>
              </div>

              {/* Social Channels if configured in Footer Settings */}
              {socialLinks.length > 0 && (
                <div className="pt-4 border-t space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Share2 className="h-3.5 w-3.5" /> Official Social Channels
                  </h4>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {socialLinks.map((link) => (
                      <a
                        key={link.id || link.name}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-secondary hover:bg-secondary/80 border border-border flex items-center gap-2 transition-colors"
                      >
                        <Globe className="h-3.5 w-3.5 text-primary" />
                        {link.name}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Embedded Google Map */}
          <div className="rounded-xl overflow-hidden border shadow-sm h-64 bg-secondary">
            <iframe
              title={`${companyInfo.city} Warehouse Location Map`}
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d117367.65778842426!2d77.34846665!3d23.25993335!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x397c428f8fd68fbd%3A0x2155716d572d4f8!2sBhopal%2C%20Madhya%20Pradesh!5e0!3m2!1sen!2sin!4v1700000000000!5m2!1sen!2sin"
              className="w-full h-full border-0"
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>

        {/* Functional Form */}
        <Card className="border shadow-md">
          <CardHeader>
            <CardTitle className="text-xl font-bold">Submit a Sourcing Inquiry</CardTitle>
          </CardHeader>
          <CardContent>
            {isSubmitted ? (
              <div className="p-8 text-center space-y-4 bg-primary/5 rounded-xl border border-primary/20">
                <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
                <h3 className="text-xl font-bold text-foreground">Inquiry Received!</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Thank you for reaching out. Your inquiry has been routed to our B2B team. We will get back to <strong>{email}</strong> shortly.
                </p>
                <Button onClick={() => setIsSubmitted(false)} variant="outline" size="sm">
                  Send Another Message
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold">First Name *</label>
                    <Input placeholder="John" value={firstName} onChange={(e) => setFirstName(e.target.value)} required disabled={isSubmitting} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold">Last Name *</label>
                    <Input placeholder="Doe" value={lastName} onChange={(e) => setLastName(e.target.value)} required disabled={isSubmitting} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold">Email Address *</label>
                  <Input type="email" placeholder="john@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={isSubmitting} />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold">Subject Category *</label>
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary cursor-pointer"
                    disabled={isSubmitting}
                  >
                    <option value="Bulk Sourcing Quote">Bulk Sourcing Quote</option>
                    <option value="Dropshipping Partnership">Dropshipping Partnership</option>
                    <option value="Franchise Application">Franchise Application</option>
                    <option value="Damaged Shipment Claim">Damaged Shipment Claim</option>
                    <option value="Logistics/Customs Delay">Logistics/Customs Delay</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold">Message *</label>
                  <textarea
                    rows={4}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary"
                    placeholder="How can our B2B team help you?"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>

                <Button type="submit" className="w-full font-bold gap-2 cursor-pointer" size="lg" disabled={isSubmitting}>
                  <Send className="h-4 w-4" /> {isSubmitting ? "Sending Inquiry..." : "Send Message"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
