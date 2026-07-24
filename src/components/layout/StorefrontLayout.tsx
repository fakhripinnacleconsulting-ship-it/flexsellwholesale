import * as React from "react";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { AnnouncementBar } from "./AnnouncementBar";
import { categoryService } from "@/services/categoryService";
import { collectionService } from "@/services/collectionService";
import dbConnect from "@/lib/dbConnect";
import CmsContent from "@/models/CmsContent";

interface StorefrontLayoutProps {
  children: React.ReactNode;
}

export async function StorefrontLayout({ children }: StorefrontLayoutProps) {
  let allCategories: any[] = [];
  let collections: any[] = [];
  let cmsAnnouncements: any = null;
  let cmsFooter: any = null;

  try {
    await dbConnect();
    const [categoriesData, collectionsData, announcementsData, footerDataRes] = await Promise.all([
      categoryService.getCategories(),
      collectionService.getCollections(),
      CmsContent.findOne({ key: "announcements" }).lean(),
      CmsContent.findOne({ key: "footer" }).lean()
    ]);
    allCategories = categoriesData;
    collections = collectionsData;
    cmsAnnouncements = announcementsData;
    cmsFooter = footerDataRes;
  } catch (err) {
    console.error("StorefrontLayout DB fetch notice (using fallback UI):", (err as any)?.message || err);
  }

  const messages = cmsAnnouncements?.value || [
    "🎉 Mega B2B Monsoon Sale! Flat 12% OFF on Bulk orders above ₹20,000. Use Code: MEGAMONSOON"
  ];
  const footerData = cmsFooter?.value || undefined;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Announcement Bar Carousel */}
      <AnnouncementBar messages={messages} />

      <Header categories={allCategories} collections={collections} />

      <main className="flex-1">
        {children}
      </main>

      <Footer data={footerData} />
    </div>
  );
}
