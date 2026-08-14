"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToastStore } from "@/stores/toastStore";
import { apiClient } from "@/lib/apiClient";

// Modular CMS Components & Types
import {
  CmsTabType,
  BannerSlide,
  TrustStatItem,
  BusinessSectionData,
  TestimonialItem,
  BrandPartner,
  FaqItem,
  BlogPostItem,
  DropshipPageContent,
  HomepageHeadingsData,
  HomepageVisibilityData,
  HomepageSeoData
} from "@/components/admin/cms/types";

import { CmsHeader } from "@/components/admin/cms/CmsHeader";
import { CmsTabsNav } from "@/components/admin/cms/CmsTabsNav";
import { CmsSubTabsNav } from "@/components/admin/cms/CmsSubTabsNav";

import { BannersTab } from "@/components/admin/cms/tabs/BannersTab";
import { AnnouncementsTab } from "@/components/admin/cms/tabs/AnnouncementsTab";
import { TrustStatsTab } from "@/components/admin/cms/tabs/TrustStatsTab";
import { BusinessSectionTab } from "@/components/admin/cms/tabs/BusinessSectionTab";
import { TestimonialsTab } from "@/components/admin/cms/tabs/TestimonialsTab";
import { BrandPartnersTab } from "@/components/admin/cms/tabs/BrandPartnersTab";
import { BlogsTab } from "@/components/admin/cms/tabs/BlogsTab";
import { DropshipPageTab } from "@/components/admin/cms/tabs/DropshipPageTab";
import { FaqsTab } from "@/components/admin/cms/tabs/FaqsTab";
import { PoliciesTab } from "@/components/admin/cms/tabs/PoliciesTab";
import { FooterTab } from "@/components/admin/cms/tabs/FooterTab";
import { SectionVisibilityTab } from "@/components/admin/cms/tabs/SectionVisibilityTab";
import { HomepageSeoTab } from "@/components/admin/cms/tabs/HomepageSeoTab";

import { CmsFormModal } from "@/components/admin/cms/modals/CmsFormModal";
import { CmsViewModal } from "@/components/admin/cms/modals/CmsViewModal";
import { CmsDeleteModal } from "@/components/admin/cms/modals/CmsDeleteModal";
import { CmsSeedModal } from "@/components/admin/cms/modals/CmsSeedModal";

export default function AdminCmsPage() {
  const { addToast } = useToastStore();

  const [activeTab, setActiveTab] = React.useState<CmsTabType>("hero");
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isSeeding, setIsSeeding] = React.useState(false);

  // State
  const [heroBanners, setHeroBanners] = React.useState<BannerSlide[]>([]);
  const [announcements, setAnnouncements] = React.useState<string[]>([]);
  const [trustStats, setTrustStats] = React.useState<TrustStatItem[]>([]);
  const [wholesaleBiz, setWholesaleBiz] = React.useState<BusinessSectionData>({ heading: "", subheading: "", cards: [], ctaText: "", ctaLink: "" });
  const [dropshipBiz, setDropshipBiz] = React.useState<BusinessSectionData>({ heading: "", subheading: "", cards: [], ctaText: "", ctaLink: "" });
  const [testimonialsWholesale, setTestimonialsWholesale] = React.useState<TestimonialItem[]>([]);
  const [testimonialsDropshipper, setTestimonialsDropshipper] = React.useState<TestimonialItem[]>([]);
  const [testimonialsClient, setTestimonialsClient] = React.useState<TestimonialItem[]>([]);
  const [brandPartners, setBrandPartners] = React.useState<BrandPartner[]>([]);
  const [blogs, setBlogs] = React.useState<BlogPostItem[]>([]);
  const [faqs, setFaqs] = React.useState<FaqItem[]>([]);
  const [policies, setPolicies] = React.useState<any>({});
  const [dropshipPage, setDropshipPage] = React.useState<any>({});
  const [footer, setFooter] = React.useState<any>({});
  const [homepageSettings, setHomepageSettings] = React.useState<HomepageVisibilityData>({});
  const [homepageSeo, setHomepageSeo] = React.useState<HomepageSeoData>({});

  // Modals
  const [formModalOpen, setFormModalOpen] = React.useState(false);
  const [editingIndex, setEditingIndex] = React.useState<number | null>(null);
  const [formData, setFormData] = React.useState<any>({});
  const [viewModalOpen, setViewModalOpen] = React.useState(false);
  const [viewData, setViewData] = React.useState<any>(null);
  const [deleteModalOpen, setDeleteModalOpen] = React.useState(false);
  const [deleteIndex, setDeleteIndex] = React.useState<number | null>(null);
  const [seedModalOpen, setSeedModalOpen] = React.useState(false);

  // Check URL Query param ?tab=... and sync tab selection
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab") as CmsTabType;
      if (tabParam) {
        if (tabParam === "testimonials") {
          setActiveTab("testimonials_wholesale");
        } else {
          setActiveTab(tabParam);
        }
      }
    }
  }, []);

  const handleTabSelect = (tab: CmsTabType) => {
    let targetTab = tab;
    if (tab === "homepage") {
      targetTab = "hero";
    } else if (tab === "testimonials") {
      targetTab = "testimonials_wholesale";
    }
    setActiveTab(targetTab);

    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", targetTab);
      window.history.pushState(null, "", url.toString());
    }
  };

  const fetchCmsData = React.useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await apiClient.get<any>(`/cms?t=${Date.now()}`, { cache: "no-store" });

      setHeroBanners(data.hero_banners || []);
      setAnnouncements(data.announcements || []);
      setTrustStats(data.trust_stats || []);
      if (data.wholesale_business_details) setWholesaleBiz(data.wholesale_business_details);
      if (data.dropshipping_business_details) setDropshipBiz(data.dropshipping_business_details);
      setTestimonialsWholesale(data.testimonials_wholesale || []);
      setTestimonialsDropshipper(data.testimonials_dropshipper || []);
      setTestimonialsClient(data.testimonials_client || []);
      setBrandPartners(data.brand_partners || []);
      setBlogs(data.blogs || []);
      setFaqs(data.faqs || []);
      setPolicies(data.policies || {});
      setDropshipPage(data.dropshipping_cms || data.dropshipping_page_content || {});
      setFooter(data.footer || {});
      if (data.homepage_settings) setHomepageSettings(data.homepage_settings);
      if (data.homepage_seo) setHomepageSeo(data.homepage_seo);
    } catch (err: unknown) {
      addToast((err as any).message || "Failed to fetch CMS settings", "error");
    } finally {
      setIsLoading(false);
    }
  }, [addToast]);

  React.useEffect(() => {
    fetchCmsData();
  }, [fetchCmsData]);

  const handleSaveCmsKey = async (key: string, value: any) => {
    try {
      setIsSaving(true);
      await apiClient.post("/cms", { key, value });
      addToast(`CMS Section '${key}' updated successfully!`, "success");
      await fetchCmsData();
    } catch (err: unknown) {
      addToast((err as any).message || "Failed to update CMS section", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleTriggerSeed = async () => {
    try {
      setIsSeeding(true);
      const data = await apiClient.post<any>("/admin/seed");
      addToast(data.message || "Database seeded successfully!", "success");
      setSeedModalOpen(false);
      fetchCmsData();
    } catch (err: unknown) {
      addToast((err as any).message || "Database seed failed", "error");
    } finally {
      setIsSeeding(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, fieldName: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isVideo = file.type.startsWith("video/");
    const maxSizeBytes = isVideo ? 30 * 1024 * 1024 : 10 * 1024 * 1024;

    if (file.size > maxSizeBytes) {
      addToast(
        `Selected ${isVideo ? "video" : "image"} (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds maximum limit (${isVideo ? "30MB" : "10MB"}). Please compress your file or paste a direct video URL.`,
        "error"
      );
      e.target.value = "";
      return;
    }

    addToast(`Uploading ${isVideo ? "video" : "file"} to Vercel Blob...`, "info");
    try {
      const formDataUpload = new FormData();
      formDataUpload.append("file", file);

      const data = await apiClient.post<any>("/upload", formDataUpload);
      
      setFormData((prev: any) => ({ ...prev, [fieldName]: data.url }));
      addToast("File uploaded successfully", "success");
    } catch (err: unknown) {
      addToast((err as any).message || "Failed to upload file", "error");
    } finally {
      e.target.value = "";
    }
  };

  const openAddModal = () => {
    setEditingIndex(null);
    if (activeTab === "hero") setFormData({ imageUrl: "", mobileImageUrl: "", redirectUrl: "/products", altText: "" });
    else if (activeTab === "announcements") setFormData({ text: "" });
    else if (activeTab === "trust") setFormData({ icon: "package", count: "1,000+", label: "New Stat" });
    else if (activeTab === "wholesale_biz" || activeTab === "dropship_biz") setFormData({ icon: "package", title: "New Highlight", desc: "Description...", badge: "Feature Badge" });
    else if (activeTab.startsWith("testimonials")) setFormData({ name: "", business: "", location: "", rating: 5, text: "", contentType: "text", mediaUrl: "", avatarUrl: "", isActive: true });
    else if (activeTab === "partners") setFormData({ name: "", logoUrl: "" });
    else if (activeTab === "blogs") setFormData({ title: "", slug: "", category: "Industry News", author: "Flexsell Editorial", excerpt: "", content: "", coverImage: "", publishedAt: new Date().toISOString(), isActive: true });
    else if (activeTab === "faqs") setFormData({ question: "", answer: "", category: "General" });
    setFormModalOpen(true);
  };

  const openEditModal = (idx: number, item: any) => {
    setEditingIndex(idx);
    setFormData({ ...item });
    setFormModalOpen(true);
  };

  const openViewModal = (item: any) => {
    setViewData(item);
    setViewModalOpen(true);
  };

  const openDeleteModal = (idx: number) => {
    setDeleteIndex(idx);
    setDeleteModalOpen(true);
  };

  const saveModalForm = () => {
    if (activeTab === "hero") {
      const copy = [...heroBanners];
      if (editingIndex === null) copy.push(formData);
      else copy[editingIndex] = formData;
      setHeroBanners(copy);
      handleSaveCmsKey("hero_banners", copy);
    } else if (activeTab === "announcements") {
      const copy = [...announcements];
      if (editingIndex === null) copy.push(formData.text);
      else copy[editingIndex] = formData.text;
      setAnnouncements(copy);
      handleSaveCmsKey("announcements", copy);
    } else if (activeTab === "trust") {
      const copy = [...trustStats];
      if (editingIndex === null) copy.push(formData);
      else copy[editingIndex] = formData;
      setTrustStats(copy);
      handleSaveCmsKey("trust_stats", copy);
    } else if (activeTab === "wholesale_biz") {
      const copyCards = [...wholesaleBiz.cards];
      if (editingIndex === null) copyCards.push(formData);
      else copyCards[editingIndex] = formData;
      const updated = { ...wholesaleBiz, cards: copyCards };
      setWholesaleBiz(updated);
      handleSaveCmsKey("wholesale_business_details", updated);
    } else if (activeTab === "dropship_biz") {
      const copyCards = [...dropshipBiz.cards];
      if (editingIndex === null) copyCards.push(formData);
      else copyCards[editingIndex] = formData;
      const updated = { ...dropshipBiz, cards: copyCards };
      setDropshipBiz(updated);
      handleSaveCmsKey("dropshipping_business_details", updated);
    } else if (activeTab === "testimonials_wholesale") {
      const copy = [...testimonialsWholesale];
      if (editingIndex === null) copy.push(formData);
      else copy[editingIndex] = formData;
      setTestimonialsWholesale(copy);
      handleSaveCmsKey("testimonials_wholesale", copy);
    } else if (activeTab === "testimonials_dropship") {
      const copy = [...testimonialsDropshipper];
      if (editingIndex === null) copy.push(formData);
      else copy[editingIndex] = formData;
      setTestimonialsDropshipper(copy);
      handleSaveCmsKey("testimonials_dropshipper", copy);
    } else if (activeTab === "testimonials_client") {
      const copy = [...testimonialsClient];
      if (editingIndex === null) copy.push(formData);
      else copy[editingIndex] = formData;
      setTestimonialsClient(copy);
      handleSaveCmsKey("testimonials_client", copy);
    } else if (activeTab === "partners") {
      const copy = [...brandPartners];
      if (editingIndex === null) copy.push(formData);
      else copy[editingIndex] = formData;
      setBrandPartners(copy);
      handleSaveCmsKey("brand_partners", copy);
    } else if (activeTab === "blogs") {
      const copy = [...blogs];
      if (editingIndex === null) copy.push({ ...formData, publishedAt: formData.publishedAt || new Date().toISOString() });
      else copy[editingIndex] = formData;
      setBlogs(copy);
      handleSaveCmsKey("blogs", copy);
    } else if (activeTab === "faqs") {
      const copy = [...faqs];
      if (editingIndex === null) copy.push(formData);
      else copy[editingIndex] = formData;
      setFaqs(copy);
      handleSaveCmsKey("faqs", copy);
    }
    setFormModalOpen(false);
  };

  const confirmDelete = () => {
    if (deleteIndex === null) return;
    if (activeTab === "hero") {
      const updated = heroBanners.filter((_, i) => i !== deleteIndex);
      setHeroBanners(updated);
      handleSaveCmsKey("hero_banners", updated);
    } else if (activeTab === "announcements") {
      const updated = announcements.filter((_, i) => i !== deleteIndex);
      setAnnouncements(updated);
      handleSaveCmsKey("announcements", updated);
    } else if (activeTab === "trust") {
      const updated = trustStats.filter((_, i) => i !== deleteIndex);
      setTrustStats(updated);
      handleSaveCmsKey("trust_stats", updated);
    } else if (activeTab === "wholesale_biz") {
      const updatedCards = wholesaleBiz.cards.filter((_, i) => i !== deleteIndex);
      const updated = { ...wholesaleBiz, cards: updatedCards };
      setWholesaleBiz(updated);
      handleSaveCmsKey("wholesale_business_details", updated);
    } else if (activeTab === "dropship_biz") {
      const updatedCards = dropshipBiz.cards.filter((_, i) => i !== deleteIndex);
      const updated = { ...dropshipBiz, cards: updatedCards };
      setDropshipBiz(updated);
      handleSaveCmsKey("dropshipping_business_details", updated);
    } else if (activeTab === "testimonials_wholesale") {
      const updated = testimonialsWholesale.filter((_, i) => i !== deleteIndex);
      setTestimonialsWholesale(updated);
      handleSaveCmsKey("testimonials_wholesale", updated);
    } else if (activeTab === "testimonials_dropship") {
      const updated = testimonialsDropshipper.filter((_, i) => i !== deleteIndex);
      setTestimonialsDropshipper(updated);
      handleSaveCmsKey("testimonials_dropshipper", updated);
    } else if (activeTab === "testimonials_client") {
      const updated = testimonialsClient.filter((_, i) => i !== deleteIndex);
      setTestimonialsClient(updated);
      handleSaveCmsKey("testimonials_client", updated);
    } else if (activeTab === "partners") {
      const updated = brandPartners.filter((_, i) => i !== deleteIndex);
      setBrandPartners(updated);
      handleSaveCmsKey("brand_partners", updated);
    } else if (activeTab === "blogs") {
      const updated = blogs.filter((_, i) => i !== deleteIndex);
      setBlogs(updated);
      handleSaveCmsKey("blogs", updated);
    } else if (activeTab === "faqs") {
      const updated = faqs.filter((_, i) => i !== deleteIndex);
      setFaqs(updated);
      handleSaveCmsKey("faqs", updated);
    }
    setDeleteModalOpen(false);
    setDeleteIndex(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-3 text-sm text-muted-foreground">Loading Unified Website CMS...</span>
      </div>
    );
  }

  const isHomePageSection =
    activeTab === "homepage" ||
    activeTab === "hero" ||
    activeTab === "announcements" ||
    activeTab === "trust" ||
    activeTab === "wholesale_biz" ||
    activeTab === "dropship_biz" ||
    activeTab === "testimonials" ||
    activeTab === "testimonials_wholesale" ||
    activeTab === "testimonials_dropship" ||
    activeTab === "testimonials_client" ||
    activeTab === "partners" ||
    activeTab === "homepage_visibility" ||
    activeTab === "homepage_seo";

  const isTestimonialSection =
    activeTab === "testimonials" ||
    activeTab === "testimonials_wholesale" ||
    activeTab === "testimonials_dropship" ||
    activeTab === "testimonials_client";

  const currentTestimonialSubTab =
    activeTab === "testimonials_dropship"
      ? "testimonials_dropship"
      : activeTab === "testimonials_client"
      ? "testimonials_client"
      : "testimonials_wholesale";

  const homeSubTabs: { id: CmsTabType; label: string; icon: string }[] = [
    { id: "hero", label: "Hero Banners", icon: "🖼️" },
    { id: "announcements", label: "Announcements", icon: "📢" },
    { id: "trust", label: "Trust Stats", icon: "📊" },
    { id: "wholesale_biz", label: "Wholesale Business", icon: "🏢" },
    { id: "dropship_biz", label: "Dropship Business", icon: "🚀" },
    { id: "testimonials_wholesale", label: "Customer Reviews", icon: "⭐" },
    { id: "partners", label: "Brand Partners", icon: "🤝" },
    { id: "homepage_visibility", label: "Section Visibility", icon: "👁️" },
    { id: "homepage_seo", label: "Homepage SEO", icon: "🔍" },
  ];

  const getActiveHomeSubTab = () => {
    if (isTestimonialSection) return "testimonials_wholesale";
    return activeTab;
  };

  return (
    <div className="space-y-6">
      <CmsHeader onOpenSeedModal={() => setSeedModalOpen(true)} />

      <CmsTabsNav activeTab={activeTab} onSelectTab={handleTabSelect} />

      <Card>
        <CardContent className="p-6 space-y-6">
          {/* Main Section Header */}
          <div className="flex justify-between items-center border-b pb-3">
            <div>
              <h2 className="font-bold text-base text-foreground uppercase tracking-wider flex items-center gap-2">
                {isHomePageSection ? "🏠 Home Page Content & Banner Settings" : `Section Settings — ${activeTab.replace("_", " ").toUpperCase()}`}
              </h2>
              {isHomePageSection && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Easily update homepage banners, announcements, trust stats, shop details, customer reviews, and section titles.
                </p>
              )}
            </div>
            {activeTab !== "footer" && activeTab !== "policies" && activeTab !== "dropship_page" && activeTab !== "homepage_visibility" && activeTab !== "homepage_seo" && (
              <Button type="button" onClick={openAddModal} className="font-bold text-xs gap-1.5 cursor-pointer">
                <Plus className="h-4 w-4" /> Add New Entry
              </Button>
            )}
          </div>

          {/* Unified Home Page Sub-Tabs Navigation Bar (Mouse drag, Wheel, Touch, Arrows) */}
          {isHomePageSection && (
            <CmsSubTabsNav
              subTabs={homeSubTabs}
              activeTab={activeTab}
              getActiveSubTab={getActiveHomeSubTab}
              onSelectSubTab={handleTabSelect}
            />
          )}

          {/* Customer Reviews Sub-Filters */}
          {isTestimonialSection && (
            <div className="flex items-center gap-2 pb-2 mb-2 border-b border-dashed">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mr-2">Review Type:</span>
              {[
                { id: "testimonials_wholesale", label: "Wholesale Reviews" },
                { id: "testimonials_dropship", label: "Dropship Reviews" },
                { id: "testimonials_client", label: "Client Reviews" },
              ].map((sub) => (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => handleTabSelect(sub.id as CmsTabType)}
                  className={`px-3 py-1 rounded-full text-xs transition-all cursor-pointer font-semibold ${
                    currentTestimonialSubTab === sub.id
                      ? "bg-primary text-primary-foreground font-bold shadow-xs"
                      : "bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {sub.label}
                </button>
              ))}
            </div>
          )}

          {activeTab === "hero" && <BannersTab banners={heroBanners} onView={openViewModal} onEdit={openEditModal} onDelete={openDeleteModal} onReorder={(newBanners) => { setHeroBanners(newBanners); handleSaveCmsKey("hero_banners", newBanners); }} />}
          {activeTab === "announcements" && <AnnouncementsTab announcements={announcements} onEdit={openEditModal} onDelete={openDeleteModal} />}
          {activeTab === "trust" && <TrustStatsTab trustStats={trustStats} onEdit={openEditModal} onDelete={openDeleteModal} />}
          {activeTab === "wholesale_biz" && <BusinessSectionTab data={wholesaleBiz} setData={setWholesaleBiz} sectionKey="wholesale_business_details" isSaving={isSaving} onSaveHeadings={handleSaveCmsKey} onEditCard={openEditModal} onDeleteCard={openDeleteModal} titleColorClass="text-emerald-600" />}
          {activeTab === "dropship_biz" && <BusinessSectionTab data={dropshipBiz} setData={setDropshipBiz} sectionKey="dropshipping_business_details" isSaving={isSaving} onSaveHeadings={handleSaveCmsKey} onEditCard={openEditModal} onDeleteCard={openDeleteModal} titleColorClass="text-purple-600" />}
          {(activeTab === "testimonials" || activeTab === "testimonials_wholesale") && <TestimonialsTab testimonials={testimonialsWholesale} onView={openViewModal} onEdit={openEditModal} onDelete={openDeleteModal} />}
          {activeTab === "testimonials_dropship" && <TestimonialsTab testimonials={testimonialsDropshipper} onView={openViewModal} onEdit={openEditModal} onDelete={openDeleteModal} />}
          {activeTab === "testimonials_client" && <TestimonialsTab testimonials={testimonialsClient} onView={openViewModal} onEdit={openEditModal} onDelete={openDeleteModal} />}
          {activeTab === "partners" && <BrandPartnersTab brandPartners={brandPartners} onEdit={openEditModal} onDelete={openDeleteModal} />}
          {activeTab === "homepage_visibility" && <SectionVisibilityTab data={homepageSettings} setData={setHomepageSettings} isSaving={isSaving} onSave={handleSaveCmsKey} />}
          {activeTab === "homepage_seo" && <HomepageSeoTab data={homepageSeo} setData={setHomepageSeo} isSaving={isSaving} onSave={handleSaveCmsKey} onFileUpload={handleFileUpload} />}
          {activeTab === "blogs" && <BlogsTab blogs={blogs} onEdit={openEditModal} onDelete={openDeleteModal} />}
          {activeTab === "dropship_page" && <DropshipPageTab data={dropshipPage} setData={setDropshipPage} isSaving={isSaving} onSave={handleSaveCmsKey} />}
          {activeTab === "faqs" && <FaqsTab faqs={faqs} onEdit={openEditModal} onDelete={openDeleteModal} />}
          {activeTab === "policies" && <PoliciesTab policies={policies} setPolicies={setPolicies} isSaving={isSaving} onSave={handleSaveCmsKey} />}
          {activeTab === "footer" && <FooterTab footer={footer} setFooter={setFooter} isSaving={isSaving} onSave={handleSaveCmsKey} />}
        </CardContent>
      </Card>

      {/* Modals */}
      <CmsFormModal isOpen={formModalOpen} activeTab={activeTab} editingIndex={editingIndex} formData={formData} setFormData={setFormData} onClose={() => setFormModalOpen(false)} onSave={saveModalForm} onFileUpload={handleFileUpload} />
      <CmsViewModal isOpen={viewModalOpen} viewData={viewData} onClose={() => setViewModalOpen(false)} />
      <CmsDeleteModal isOpen={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} onConfirm={confirmDelete} />
      <CmsSeedModal isOpen={seedModalOpen} isSeeding={isSeeding} onClose={() => setSeedModalOpen(false)} onConfirm={handleTriggerSeed} />
    </div>
  );
}
