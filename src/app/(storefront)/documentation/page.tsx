import { DocumentationView } from "@/components/storefront/DocumentationView";
import type { Metadata } from "next";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Application Architecture & Technical Documentation | FlexSell Wholesale",
  description: "Complete technical documentation, system architecture, database schema, API reference, and B2B workflow documentation for FlexSell Wholesale.",
  keywords: "FlexSell documentation, B2B architecture, API reference, Next.js e-commerce docs, GST tax engine, Shiprocket integration, Razorpay sequence"
};

export default function DocumentationPage() {
  return <DocumentationView />;
}
