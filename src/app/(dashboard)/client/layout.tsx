import * as React from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ClientSidebar } from "@/components/layout/ClientSidebar";

export const dynamic = "force-dynamic";

import { getActiveCustomerServer } from "@/lib/auth";
import { categoryService } from "@/services/categoryService";
import { collectionService } from "@/services/collectionService";
import { redirect } from "next/navigation";

export default async function ClientDashboardLayout({ children }: { children: React.ReactNode }) {
  const activeCustomer = await getActiveCustomerServer();
  if (!activeCustomer) {
    redirect("/login");
  }
  const allCategories = await categoryService.getCategories();
  const collections = await collectionService.getCollections();

  return (
    <div className="min-h-screen flex flex-col bg-secondary/20">
      <Header categories={allCategories} collections={collections} />

      <div className="flex-1 mx-auto max-w-8xl px-4 md:px-6 py-8 flex flex-col md:flex-row gap-8 w-full">
        {/* Responsive Sidebar Component */}
        <ClientSidebar activeCustomer={activeCustomer} />

        {/* Main Content */}
        <main className="flex-1">
          {children}
        </main>
      </div>

      <Footer />
    </div>
  );
}
