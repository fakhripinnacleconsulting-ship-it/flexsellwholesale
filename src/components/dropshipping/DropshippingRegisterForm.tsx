"use client";

import React, { useState, useEffect } from "react";
import { UserCheck, Mail, Phone, Store, Package, CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToastStore } from "@/stores/toastStore";
import { useAuthStore } from "@/stores/authStore";
import { DropshippingPlan } from "@/lib/seedDropshippingCMS";
import { dispatchEvent } from "@/lib/events/eventDispatcher";

interface DropshippingRegisterFormProps {
  selectedPlan?: string;
  plans?: DropshippingPlan[];
}

export function DropshippingRegisterForm({ selectedPlan, plans }: DropshippingRegisterFormProps) {
  const { addToast } = useToastStore();
  const customer = useAuthStore((state: any) => state.customer);

  const defaultPlanChoice = selectedPlan || plans?.[0]?.name || "Gold Plan — 6 Months";

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    amazonStoreName: "",
    monthlyOrderVolume: "1-50 orders/month",
    planChoice: defaultPlanChoice,
    message: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (selectedPlan) {
      setFormData((prev) => ({ ...prev, planChoice: selectedPlan }));
    }
  }, [selectedPlan]);

  useEffect(() => {
    if (customer) {
      setFormData((prev) => ({
        ...prev,
        name: prev.name || customer.name || "",
        email: prev.email || customer.email || "",
        phone: prev.phone || customer.phone || "",
      }));
    }
  }, [customer]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.phone) {
      addToast("Please fill in your name, email, and phone number.", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const nameParts = formData.name.trim().split(" ");
      const firstName = nameParts[0] || "Partner";
      const lastName = nameParts.slice(1).join(" ") || "Applicant";

      const res = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: "dropshipping",
          firstName,
          lastName,
          email: formData.email,
          phone: formData.phone,
          company: formData.amazonStoreName || "Amazon Seller",
          subject: `Dropshipping Partner Application — ${formData.planChoice}`,
          message: `Monthly Order Volume: ${formData.monthlyOrderVolume}\nAmazon Store: ${formData.amazonStoreName || "N/A"}\nPlan Choice: ${formData.planChoice}\nUser Note: ${formData.message || "N/A"}`,
          expectedOrders: formData.monthlyOrderVolume,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to submit application");
      }

      // Dispatch event locally for instant sandbox drawer updates
      try {
        dispatchEvent({
          eventType: "INQUIRY_SUBMITTED",
          category: "quotes",
          actor: {
            id: data.inquiry?._id || `inq_${Date.now()}`,
            name: `${firstName} ${lastName}`,
            role: "customer"
          },
          recipient: {
            role: "both",
            email: formData.email,
            name: `${firstName} ${lastName}`
          },
          entity: {
            type: "inquiry",
            id: data.inquiry?._id || `inq_${Date.now()}`
          },
          data: {
            subject: `Dropshipping Partner Application — ${formData.planChoice}`,
            message: formData.message || "Dropshipping partner onboarding request",
            customerName: `${firstName} ${lastName}`,
            email: formData.email,
            company: formData.amazonStoreName || "Amazon Seller"
          }
        });
      } catch (evtErr) {
        console.warn("Client dispatch event failed:", evtErr);
      }

      setSubmitted(true);
      addToast("Application submitted successfully! Our onboarding team will contact you shortly.", "success");
    } catch (err: any) {
      console.error(err);
      addToast(err.message || "Something went wrong. Please try again.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="register-form" className="py-16 md:py-24 bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-950 text-white px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12 space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold uppercase tracking-wider">
            <UserCheck className="w-4 h-4 text-emerald-400" />
            <span>Partner Onboarding Application</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
            Apply as FlexSell Dropship Partner
          </h2>
          <p className="text-slate-300 text-sm sm:text-base max-w-xl mx-auto">
            Fill out the form below to start selling on Amazon with zero inventory investment.
          </p>
        </div>

        {submitted ? (
          <div className="bg-slate-900/90 border border-emerald-500/40 rounded-3xl p-8 sm:p-12 text-center backdrop-blur-md shadow-2xl space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-bold">Application Received!</h3>
            <p className="text-slate-300 text-sm sm:text-base max-w-md mx-auto">
              Thank you for applying, <span className="font-semibold text-emerald-400">{formData.name}</span>. Our onboarding manager will review your details and connect with you on <span className="font-semibold text-emerald-400">{formData.phone}</span> within 24 hours.
            </p>
            <Button
              onClick={() => setSubmitted(false)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 py-2.5 rounded-xl text-sm"
            >
              Submit Another Application
            </Button>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="bg-slate-900/90 border border-emerald-900/50 rounded-3xl p-6 sm:p-10 shadow-2xl backdrop-blur-md space-y-6"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Full Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Full Name *
                </label>
                <div className="relative">
                  <UserCheck className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    name="name"
                    required
                    placeholder="Enter your name"
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full bg-slate-800/80 border border-slate-700 focus:border-emerald-500 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Email Address *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="email"
                    name="email"
                    required
                    placeholder="name@example.com"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full bg-slate-800/80 border border-slate-700 focus:border-emerald-500 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Phone / WhatsApp */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Phone / WhatsApp Number *
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="tel"
                    name="phone"
                    required
                    placeholder="+91 9876543210"
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full bg-slate-800/80 border border-slate-700 focus:border-emerald-500 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Amazon Store Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Amazon Store Name (Optional)
                </label>
                <div className="relative">
                  <Store className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    name="amazonStoreName"
                    placeholder="Your Amazon storefront name"
                    value={formData.amazonStoreName}
                    onChange={handleChange}
                    className="w-full bg-slate-800/80 border border-slate-700 focus:border-emerald-500 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none transition-colors"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Monthly Order Volume */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Target Monthly Order Volume
                </label>
                <div className="relative">
                  <Package className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <select
                    name="monthlyOrderVolume"
                    value={formData.monthlyOrderVolume}
                    onChange={handleChange}
                    className="w-full bg-slate-800/80 border border-slate-700 focus:border-emerald-500 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none transition-colors"
                  >
                    <option value="New Seller (0 orders)">New Seller (0 orders yet)</option>
                    <option value="1-50 orders/month">1 - 50 orders / month</option>
                    <option value="50-200 orders/month">50 - 200 orders / month</option>
                    <option value="200+ orders/month">200+ orders / month</option>
                  </select>
                </div>
              </div>

              {/* Subscription Plan Choice */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Subscription Plan Choice
                </label>
                <select
                  name="planChoice"
                  value={formData.planChoice}
                  onChange={handleChange}
                  className="w-full bg-slate-800/80 border border-slate-700 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none transition-colors"
                >
                  {plans && plans.length > 0 ? (
                    plans.map((p) => (
                      <option key={p.id} value={p.name}>
                        {p.name}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="Gold Plan — 3 Months">Gold Plan — 3 Months (₹12,000)</option>
                      <option value="Gold Plan — 6 Months">Gold Plan — 6 Months (₹20,000)</option>
                    </>
                  )}
                </select>
              </div>
            </div>

            {/* Additional Note */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Additional Notes / Questions (Optional)
              </label>
              <textarea
                name="message"
                rows={3}
                placeholder="Tell us about your selling experience or any specific questions..."
                value={formData.message}
                onChange={handleChange}
                className="w-full bg-slate-800/80 border border-slate-700 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none transition-colors resize-none"
              />
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-purple-900/40 text-base transition-all flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <span>Submitting Application...</span>
              ) : (
                <>
                  <span>Submit Partner Application</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </Button>
          </form>
        )}
      </div>
    </section>
  );
}
