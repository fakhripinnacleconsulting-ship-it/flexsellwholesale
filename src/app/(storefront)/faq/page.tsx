"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ChevronDown, HelpCircle, MessageSquare } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface FaqItem {
  question: string;
  answer: string;
  category?: string;
}

export default function FAQPage() {
  const [openIdx, setOpenIdx] = React.useState<number | null>(0);
  const [faqItems, setFaqItems] = React.useState<FaqItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    async function fetchFaqs() {
      try {
        const res = await fetch("/api/cms");
        if (!res.ok) throw new Error("Failed to load FAQs");
        const data = await res.json();
        if (data.faqs && Array.isArray(data.faqs)) {
          setFaqItems(data.faqs);
        }
      } catch (err) {
        console.error("Error loading FAQs:", err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchFaqs();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-3 text-sm text-muted-foreground">Loading FAQs...</span>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl text-foreground space-y-8">
      <div className="text-center space-y-3">
        <div className="p-3 bg-primary/10 rounded-full w-max mx-auto text-primary">
          <HelpCircle className="h-8 w-8" />
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">B2B Sourcing Help & FAQ</h1>
        <p className="text-sm text-muted-foreground">Clear answers regarding MOQs, GST invoices, logistics operations, and dropshipping.</p>
      </div>

      <div className="space-y-4">
        {faqItems.map((faq, index) => {
          const isOpen = openIdx === index;
          return (
            <Card key={index} className="border shadow-sm overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenIdx(isOpen ? null : index)}
                className="w-full p-5 text-left font-bold text-base flex justify-between items-center gap-4 hover:text-primary transition-colors cursor-pointer bg-card"
              >
                <span>{faq.question}</span>
                <ChevronDown className={`h-5 w-5 text-muted-foreground shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180 text-primary" : ""}`} />
              </button>
              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <CardContent className="px-5 pb-5 pt-0 text-xs md:text-sm text-muted-foreground leading-relaxed border-t border-border/40">
                      <p className="pt-3">{faq.answer}</p>
                    </CardContent>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          );
        })}
      </div>

      {/* Still Have Questions CTA */}
      <Card className="border bg-secondary/20 text-center p-8 space-y-4">
        <MessageSquare className="h-8 w-8 text-primary mx-auto" />
        <h3 className="text-xl font-bold">Still have questions regarding bulk cargo?</h3>
        <p className="text-xs text-muted-foreground max-w-md mx-auto">
          Our Surat support team is available Mon-Sat, 9:30 AM to 6:30 PM to assist with custom quotes and shipping queries.
        </p>
        <div className="pt-2">
          <Link href="/contact">
            <Button className="font-bold cursor-pointer">
              Contact Support Team &rarr;
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
