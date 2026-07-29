import * as React from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ClientSidebar } from "@/components/layout/ClientSidebar";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { getActiveCustomerServer } from "@/lib/auth";
import { categoryService } from "@/services/categoryService";
import { collectionService } from "@/services/collectionService";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ClientDashboardLayout({ children }: { children: React.ReactNode }) {
  const [activeCustomer, allCategories, collections] = await Promise.all([
    getActiveCustomerServer(),
    categoryService.getCategories().catch(() => []),
    collectionService.getCollections().catch(() => []),
  ]);

  if (!activeCustomer) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen flex flex-col bg-secondary/20 pb-16 md:pb-0">
      <Header categories={allCategories} collections={collections} />

      <div className="flex-1 mx-auto max-w-8xl px-4 md:px-6 py-6 md:py-8 flex flex-col md:flex-row gap-6 md:gap-8 w-full">
        {/* Responsive Sidebar Component */}
        <ClientSidebar activeCustomer={activeCustomer} />

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          {children}
        </main>
      </div>

      <Footer />

      {/* Floating Mobile Bottom Navigation Bar */}
      <MobileBottomNav />
    </div>
  );
}
