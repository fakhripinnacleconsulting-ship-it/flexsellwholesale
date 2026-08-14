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
  HomepageSeoData,
  HomepageLayout,
  BannerSection,
  BuiltinSectionKey,
  LocationSectionData
} from "@/components/admin/cms/types";
import {
  getEffectiveLayout,
  layoutToVisibilitySettings,
  setBuiltinVisibility,
  validateLayout,
} from "@/lib/homepageLayout";
import {
  DESKTOP_ASPECT_PRESETS,
  MOBILE_ASPECT_PRESETS,
  DEFAULT_DESKTOP_RATIO,
  DEFAULT_MOBILE_RATIO,
  getPreset,
} from "@/lib/bannerAspectRatios";

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
import { HomepageSeoTab } from "@/components/admin/cms/tabs/HomepageSeoTab";
import { HomepageLayoutTab } from "@/components/admin/cms/tabs/HomepageLayoutTab";
import { BannerSectionEditor } from "@/components/admin/cms/tabs/BannerSectionEditor";
import { LocationSectionTab } from "@/components/admin/cms/tabs/LocationSectionTab";

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

  // Layout-driven homepage. `homepageLayout` is always a full layout — derived from the
  // legacy visibility booleans when nothing has been saved yet — so the editor never has
  // to special-case "no layout exists".
  const [homepageLayout, setHomepageLayout] = React.useState<HomepageLayout>({ version: 1, sections: [] });
  const [bannerSections, setBannerSections] = React.useState<BannerSection[]>([]);
  const [locationSection, setLocationSection] = React.useState<LocationSectionData>({});
  /** Non-null while drilled into one banner section's editor. */
  const [editingBannerSectionId, setEditingBannerSectionId] = React.useState<string | null>(null);

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
        } else if (tabParam === "homepage_visibility") {
          // Retired tab — see handleTabSelect.
          setActiveTab("homepage_layout");
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
    } else if (tab === "homepage_visibility") {
      // Retired: the Page Layout tab owns visibility now. Redirect rather than 404 into a
      // blank panel, since ?tab=homepage_visibility may be bookmarked.
      targetTab = "homepage_layout";
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

      // Same accessor the storefront uses, so the editor can never show a different
      // order than the live page.
      setHomepageLayout(getEffectiveLayout(data.homepage_layout, data.homepage_settings));
      setBannerSections(Array.isArray(data.banner_sections) ? data.banner_sections : []);
      setLocationSection(data.location_section || {});
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

  /**
   * Persists the layout and its banner sections together.
   *
   * These keys are one logical unit: a layout row pointing at a banner section that was
   * not saved renders a gap on the live homepage. Validate first, write the sections
   * before the layout that references them, and refetch once at the end.
   *
   * `homepage_settings` is written too — not as a second source of truth, but because
   * getEffectiveLayout() falls back to those booleans for any store that has never saved
   * a layout, and /api/cms merges defaults into them.
   */
  const persistLayout = async (layout: HomepageLayout, sections: BannerSection[]) => {
    const problems = validateLayout(layout, sections);
    if (problems.length > 0) {
      addToast(problems[0], "error");
      return false;
    }

    try {
      setIsSaving(true);
      await apiClient.post("/cms", { key: "banner_sections", value: sections });
      await apiClient.post("/cms", { key: "homepage_layout", value: layout });
      await apiClient.post("/cms", {
        key: "homepage_settings",
        value: layoutToVisibilitySettings(layout, homepageSettings),
      });
      await fetchCmsData();
      return true;
    } catch (err: unknown) {
      addToast((err as any).message || "Failed to save homepage layout", "error");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveLayout = async () => {
    const ok = await persistLayout(homepageLayout, bannerSections);
    if (ok) addToast("Homepage layout saved successfully!", "success");
  };

  /**
   * The single entry point for toggling a built-in section's visibility.
   *
   * Convenience toggles that live outside the Page Layout tab (e.g. the one on the Brand
   * Partners tab) route through here. Writing `homepage_settings` directly from those
   * places used to silently do nothing on the live site: once a layout exists it is what
   * the storefront reads, so a flag flipped behind its back was simply ignored.
   */
  const handleToggleBuiltinVisibility = async (key: BuiltinSectionKey, visible: boolean) => {
    const nextLayout = setBuiltinVisibility(homepageLayout, key, visible);
    setHomepageLayout(nextLayout);
    const ok = await persistLayout(nextLayout, bannerSections);
    if (ok) addToast(`Section ${visible ? "shown on" : "hidden from"} the storefront.`, "success");
  };

  const editingBannerSection = editingBannerSectionId
    ? bannerSections.find((s) => s.id === editingBannerSectionId) || null
    : null;

  const updateBannerSection = (updated: BannerSection) => {
    setBannerSections((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
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
    // Banners inside a custom section use the same form as hero banners.
    if (editingBannerSectionId) {
      setFormData({ imageUrl: "", mobileImageUrl: "", redirectUrl: "/products", altText: "" });
      setFormModalOpen(true);
      return;
    }
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
    // Inside a banner section, the modal edits that section's banners rather than any of
    // the top-level CMS keys. Handled first so the activeTab chain below never runs.
    if (editingBannerSectionId && editingBannerSection) {
      const banners = [...editingBannerSection.banners];
      if (editingIndex === null) banners.push(formData);
      else banners[editingIndex] = formData;
      updateBannerSection({ ...editingBannerSection, banners });
      setFormModalOpen(false);
      return;
    }

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

    if (editingBannerSectionId && editingBannerSection) {
      updateBannerSection({
        ...editingBannerSection,
        banners: editingBannerSection.banners.filter((_, i) => i !== deleteIndex),
      });
      setDeleteModalOpen(false);
      setDeleteIndex(null);
      return;
    }

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
    activeTab === "homepage_layout" ||
    activeTab === "homepage_location" ||
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
    // First: this is the entry point for the homepage now — order, custom banner
    // sections and visibility all live here.
    { id: "homepage_layout", label: "Page Layout & Banners", icon: "🧩" },
    { id: "hero", label: "Hero Banners", icon: "🖼️" },
    { id: "announcements", label: "Announcements", icon: "📢" },
    { id: "trust", label: "Trust Stats", icon: "📊" },
    { id: "wholesale_biz", label: "Wholesale Business", icon: "🏢" },
    { id: "dropship_biz", label: "Dropship Business", icon: "🚀" },
    { id: "testimonials_wholesale", label: "Customer Reviews", icon: "⭐" },
    { id: "partners", label: "Brand Partners", icon: "🤝" },
    { id: "homepage_location", label: "Location & Map", icon: "📍" },
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
            {activeTab !== "footer" && activeTab !== "policies" && activeTab !== "dropship_page" && activeTab !== "homepage_seo" && activeTab !== "homepage_layout" && activeTab !== "homepage_location" && (
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
          {activeTab === "partners" && (
            <BrandPartnersTab
              brandPartners={brandPartners}
              // Read from and written through the layout — the storefront reads the
              // layout, so a boolean flipped independently of it would have no effect.
              isVisible={
                homepageLayout.sections.find(
                  (s) => s.kind === "builtin" && s.key === "brandPartners"
                )?.visible !== false
              }
              onToggleVisibility={(visible) => handleToggleBuiltinVisibility("brandPartners", visible)}
              onEdit={openEditModal}
              onDelete={openDeleteModal}
            />
          )}
          {activeTab === "homepage_layout" && (
            editingBannerSection ? (
              <BannerSectionEditor
                section={editingBannerSection}
                onChange={updateBannerSection}
                onBack={() => setEditingBannerSectionId(null)}
                onAddBanner={openAddModal}
                onViewBanner={openViewModal}
                onEditBanner={openEditModal}
                onDeleteBanner={openDeleteModal}
              />
            ) : (
              <HomepageLayoutTab
                layout={homepageLayout}
                setLayout={setHomepageLayout}
                bannerSections={bannerSections}
                setBannerSections={setBannerSections}
                isSaving={isSaving}
                onSave={handleSaveLayout}
                onManageBanners={setEditingBannerSectionId}
              />
            )
          )}
          {activeTab === "homepage_location" && <LocationSectionTab data={locationSection} setData={setLocationSection} isSaving={isSaving} onSave={handleSaveCmsKey} />}
          {activeTab === "homepage_seo" && <HomepageSeoTab data={homepageSeo} setData={setHomepageSeo} isSaving={isSaving} onSave={handleSaveCmsKey} onFileUpload={handleFileUpload} />}
          {activeTab === "blogs" && <BlogsTab blogs={blogs} onEdit={openEditModal} onDelete={openDeleteModal} />}
          {activeTab === "dropship_page" && <DropshipPageTab data={dropshipPage} setData={setDropshipPage} isSaving={isSaving} onSave={handleSaveCmsKey} />}
          {activeTab === "faqs" && <FaqsTab faqs={faqs} onEdit={openEditModal} onDelete={openDeleteModal} />}
          {activeTab === "policies" && <PoliciesTab policies={policies} setPolicies={setPolicies} isSaving={isSaving} onSave={handleSaveCmsKey} />}
          {activeTab === "footer" && <FooterTab footer={footer} setFooter={setFooter} isSaving={isSaving} onSave={handleSaveCmsKey} />}
        </CardContent>
      </Card>

      {/* Modals */}
      {/* Banners in a custom section reuse the hero banner form verbatim, plus the
          section's fixed crop ratios so the admin sizes the image correctly up front. */}
      <CmsFormModal
        targetRatios={
          editingBannerSection
            ? {
                desktopLabel: editingBannerSection.aspectRatio || DEFAULT_DESKTOP_RATIO,
                desktopRecommended:
                  getPreset(editingBannerSection.aspectRatio || DEFAULT_DESKTOP_RATIO, DESKTOP_ASPECT_PRESETS)
                    ?.recommended || "",
                mobileLabel: editingBannerSection.mobileAspectRatio || DEFAULT_MOBILE_RATIO,
                mobileRecommended:
                  getPreset(editingBannerSection.mobileAspectRatio || DEFAULT_MOBILE_RATIO, MOBILE_ASPECT_PRESETS)
                    ?.recommended || "",
              }
            : undefined
        }
        isOpen={formModalOpen} activeTab={editingBannerSectionId ? "hero" : activeTab} editingIndex={editingIndex} formData={formData} setFormData={setFormData} onClose={() => setFormModalOpen(false)} onSave={saveModalForm} onFileUpload={handleFileUpload} />
      <CmsViewModal isOpen={viewModalOpen} viewData={viewData} onClose={() => setViewModalOpen(false)} />
      <CmsDeleteModal isOpen={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} onConfirm={confirmDelete} />
      <CmsSeedModal isOpen={seedModalOpen} isSeeding={isSeeding} onClose={() => setSeedModalOpen(false)} onConfirm={handleTriggerSeed} />
    </div>
  );
}
