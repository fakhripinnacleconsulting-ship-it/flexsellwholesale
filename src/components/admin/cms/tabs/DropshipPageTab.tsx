"use client";

import * as React from "react";
import { uploadFileAndGetUrl } from "@/lib/uploadHelper";
import {
  Save,
  Plus,
  Trash2,
  Sparkles,
  Building,
  CreditCard,
  Image as ImageIcon,
  Upload,
  Layers,
  Truck,
  FileText,
  HelpCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { DropshippingCMSData, initialDropshippingCMSData } from "@/lib/seedDropshippingCMS";
import { useToastStore } from "@/stores/toastStore";

interface DropshipPageTabProps {
  data?: any;
  setData?: React.Dispatch<React.SetStateAction<any>>;
  isSaving?: boolean;
  onSave: (key: string, data: any) => void;
}

export function DropshipPageTab({ data, setData, isSaving, onSave }: DropshipPageTabProps) {
  const { addToast } = useToastStore();
  const [cms, setCms] = React.useState<DropshippingCMSData>(data || initialDropshippingCMSData);
  const [activeSection, setActiveSection] = React.useState<string>("hero");

  React.useEffect(() => {
    if (data && Object.keys(data).length > 0) {
      setCms((prev) => ({
        ...initialDropshippingCMSData,
        ...data,
        hero: { ...initialDropshippingCMSData.hero, ...(data.hero || {}) },
        whyFlexsell: { ...initialDropshippingCMSData.whyFlexsell, ...(data.whyFlexsell || {}) },
        howItWorks: { ...initialDropshippingCMSData.howItWorks, ...(data.howItWorks || {}) },
        comparison: { ...initialDropshippingCMSData.comparison, ...(data.comparison || {}) },
        pricing: { ...initialDropshippingCMSData.pricing, ...(data.pricing || {}) },
        bankDetails: { ...initialDropshippingCMSData.bankDetails, ...(data.bankDetails || {}) },
        gstDetails: { ...initialDropshippingCMSData.gstDetails, ...(data.gstDetails || {}) },
        shippingRates: { ...initialDropshippingCMSData.shippingRates, ...(data.shippingRates || {}) },
        terms: { ...initialDropshippingCMSData.terms, ...(data.terms || {}) },
      }));
    }
  }, [data]);

  const handleUpdate = (updated: DropshippingCMSData) => {
    setCms(updated);
    if (setData) setData(updated);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, onComplete: (url: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      addToast("Uploading image...", "info");
      const imageUrl = await uploadFileAndGetUrl(file, "image");
      if (imageUrl) {
        onComplete(imageUrl);
        addToast("Image uploaded successfully!", "success");
      }
    } catch (err: any) {
      addToast(err.message || "Failed to upload image", "error");
    }
  };

  const handleSaveAll = () => {
    onSave("dropshipping_cms", cms);
  };

  const toggleSection = (sectionKey: string) => {
    setActiveSection(activeSection === sectionKey ? "" : sectionKey);
  };

  return (
    <div className="space-y-6 text-foreground pb-12">
      {/* Top Global Save Header Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-purple-600/10 border border-purple-500/30 rounded-2xl">
        <div>
          <h2 className="text-base font-extrabold text-foreground flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600 animate-pulse" />
            <span>Complete Dropshipping Page CMS Manager</span>
          </h2>
          <p className="text-xs text-muted-foreground">
            Manage all 9 sections, text headings, images, pricing plans, bank details, and policies dynamically.
          </p>
        </div>
        <Button
          onClick={handleSaveAll}
          disabled={isSaving}
          className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 text-white font-bold gap-2 shadow-lg shadow-purple-600/20 px-6 py-2.5 rounded-xl cursor-pointer"
        >
          <Save className="h-4 w-4" />
          <span>{isSaving ? "Saving All..." : "Save All Dropshipping Settings"}</span>
        </Button>
      </div>

      {/* Accordion 1: Hero Section Settings */}
      <div className="border rounded-2xl bg-card overflow-hidden shadow-xs">
        <button
          onClick={() => toggleSection("hero")}
          className="w-full p-4 text-left flex items-center justify-between font-bold text-sm bg-muted/30 hover:bg-muted/50 transition-colors"
        >
          <span className="flex items-center gap-2 text-foreground">
            <Sparkles className="h-4 w-4 text-purple-600" />
            1. Hero Banner Settings
          </span>
          {activeSection === "hero" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {activeSection === "hero" && (
          <div className="p-5 space-y-4 border-t">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-muted-foreground">Badge Label</label>
                <Input
                  value={cms.hero?.badge || ""}
                  onChange={(e) => handleUpdate({ ...cms, hero: { ...cms.hero, badge: e.target.value } })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-muted-foreground">CTA Button Text</label>
                <Input
                  value={cms.hero?.ctaText || ""}
                  onChange={(e) => handleUpdate({ ...cms, hero: { ...cms.hero, ctaText: e.target.value } })}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-muted-foreground">Main Title</label>
              <Input
                value={cms.hero?.title || ""}
                onChange={(e) => handleUpdate({ ...cms, hero: { ...cms.hero, title: e.target.value } })}
                className="font-bold"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-muted-foreground">Subtitle</label>
              <textarea
                rows={3}
                value={cms.hero?.subtitle || ""}
                onChange={(e) => handleUpdate({ ...cms, hero: { ...cms.hero, subtitle: e.target.value } })}
                className="w-full p-2.5 text-xs rounded-xl border border-input bg-background focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-muted-foreground">Brochure PDF URL</label>
                <Input
                  value={cms.hero?.brochureUrl || ""}
                  onChange={(e) => handleUpdate({ ...cms, hero: { ...cms.hero, brochureUrl: e.target.value } })}
                />
              </div>

              {/* Hero Image */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-muted-foreground">Hero Image URL</label>
                <div className="flex gap-2">
                  <Input
                    value={cms.hero?.heroImage || ""}
                    onChange={(e) => handleUpdate({ ...cms, hero: { ...cms.hero, heroImage: e.target.value } })}
                  />
                  <label className="cursor-pointer bg-secondary hover:bg-secondary/80 text-secondary-foreground px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 shrink-0">
                    <Upload className="h-3.5 w-3.5" />
                    <span>Upload</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) =>
                        handleFileUpload(e, (url) => handleUpdate({ ...cms, hero: { ...cms.hero, heroImage: url } }))
                      }
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Hero Image Thumbnail */}
            {cms.hero?.heroImage && (
              <div className="flex items-center gap-3 p-2 border rounded-xl bg-muted/20 max-w-xs">
                <img src={cms.hero.heroImage} alt="Hero" className="w-16 h-12 object-cover rounded-lg" />
                <span className="text-xs text-muted-foreground truncate">{cms.hero.heroImage}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Accordion 2: Why Choose / Benefits Section */}
      <div className="border rounded-2xl bg-card overflow-hidden shadow-xs">
        <button
          onClick={() => toggleSection("whyFlexsell")}
          className="w-full p-4 text-left flex items-center justify-between font-bold text-sm bg-muted/30 hover:bg-muted/50 transition-colors"
        >
          <span className="flex items-center gap-2 text-foreground">
            <Layers className="h-4 w-4 text-emerald-600" />
            2. Why Choose FlexSell Benefits Section
          </span>
          {activeSection === "whyFlexsell" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {activeSection === "whyFlexsell" && (
          <div className="p-5 space-y-4 border-t">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-muted-foreground">Heading</label>
                <Input
                  value={cms.whyFlexsell?.heading || ""}
                  onChange={(e) =>
                    handleUpdate({ ...cms, whyFlexsell: { ...cms.whyFlexsell, heading: e.target.value } })
                  }
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-muted-foreground">Banner Image URL</label>
                <div className="flex gap-2">
                  <Input
                    value={cms.whyFlexsell?.bannerImage || ""}
                    onChange={(e) =>
                      handleUpdate({ ...cms, whyFlexsell: { ...cms.whyFlexsell, bannerImage: e.target.value } })
                    }
                  />
                  <label className="cursor-pointer bg-secondary hover:bg-secondary/80 text-secondary-foreground px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 shrink-0">
                    <Upload className="h-3.5 w-3.5" />
                    <span>Upload</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) =>
                        handleFileUpload(e, (url) =>
                          handleUpdate({ ...cms, whyFlexsell: { ...cms.whyFlexsell, bannerImage: url } })
                        )
                      }
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-muted-foreground">Subheading</label>
              <textarea
                rows={2}
                value={cms.whyFlexsell?.subheading || ""}
                onChange={(e) =>
                  handleUpdate({ ...cms, whyFlexsell: { ...cms.whyFlexsell, subheading: e.target.value } })
                }
                className="w-full p-2.5 text-xs rounded-xl border border-input bg-background focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Benefit Cards List */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase text-muted-foreground">Benefit Cards</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const newBenefit = {
                      id: `b-${Date.now()}`,
                      title: "New Benefit Title",
                      description: "Benefit description details...",
                      icon: "shield",
                    };
                    handleUpdate({
                      ...cms,
                      whyFlexsell: {
                        ...cms.whyFlexsell,
                        benefits: [...(cms.whyFlexsell?.benefits || []), newBenefit],
                      },
                    });
                  }}
                  className="text-xs gap-1"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Benefit Card
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {cms.whyFlexsell?.benefits?.map((b, idx) => (
                  <div key={b.id || idx} className="p-3 border rounded-xl bg-muted/10 space-y-2 relative">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase text-emerald-600">Card #{idx + 1}</span>
                      <button
                        onClick={() => {
                          const updated = cms.whyFlexsell?.benefits?.filter((_, i) => i !== idx) || [];
                          handleUpdate({ ...cms, whyFlexsell: { ...cms.whyFlexsell, benefits: updated } });
                        }}
                        className="text-destructive hover:opacity-80 p-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <Input
                      placeholder="Benefit Title"
                      value={b.title}
                      onChange={(e) => {
                        const updated = [...(cms.whyFlexsell?.benefits || [])];
                        updated[idx].title = e.target.value;
                        handleUpdate({ ...cms, whyFlexsell: { ...cms.whyFlexsell, benefits: updated } });
                      }}
                      className="text-xs font-bold"
                    />

                    <textarea
                      rows={2}
                      placeholder="Benefit Description"
                      value={b.description}
                      onChange={(e) => {
                        const updated = [...(cms.whyFlexsell?.benefits || [])];
                        updated[idx].description = e.target.value;
                        handleUpdate({ ...cms, whyFlexsell: { ...cms.whyFlexsell, benefits: updated } });
                      }}
                      className="w-full p-2 text-xs rounded-lg border border-input bg-background"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Accordion 3: How It Works 5-Step Process */}
      <div className="border rounded-2xl bg-card overflow-hidden shadow-xs">
        <button
          onClick={() => toggleSection("howItWorks")}
          className="w-full p-4 text-left flex items-center justify-between font-bold text-sm bg-muted/30 hover:bg-muted/50 transition-colors"
        >
          <span className="flex items-center gap-2 text-foreground">
            <Layers className="h-4 w-4 text-blue-600" />
            3. How It Works (5-Step Process)
          </span>
          {activeSection === "howItWorks" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {activeSection === "howItWorks" && (
          <div className="p-5 space-y-4 border-t">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-muted-foreground">Heading</label>
                <Input
                  value={cms.howItWorks?.heading || ""}
                  onChange={(e) =>
                    handleUpdate({ ...cms, howItWorks: { ...cms.howItWorks, heading: e.target.value } })
                  }
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-muted-foreground">Tagline</label>
                <Input
                  value={cms.howItWorks?.tagline || ""}
                  onChange={(e) =>
                    handleUpdate({ ...cms, howItWorks: { ...cms.howItWorks, tagline: e.target.value } })
                  }
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-muted-foreground">Process Image URL</label>
              <div className="flex gap-2">
                <Input
                  value={cms.howItWorks?.processImage || ""}
                  onChange={(e) =>
                    handleUpdate({ ...cms, howItWorks: { ...cms.howItWorks, processImage: e.target.value } })
                  }
                />
                <label className="cursor-pointer bg-secondary hover:bg-secondary/80 text-secondary-foreground px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 shrink-0">
                  <Upload className="h-3.5 w-3.5" />
                  <span>Upload</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) =>
                      handleFileUpload(e, (url) =>
                        handleUpdate({ ...cms, howItWorks: { ...cms.howItWorks, processImage: url } })
                      )
                    }
                  />
                </label>
              </div>
            </div>

            {/* Steps List */}
            <div className="space-y-3 pt-2">
              <label className="text-xs font-extrabold uppercase text-muted-foreground block">Workflow Steps</label>
              <div className="space-y-3">
                {cms.howItWorks?.steps?.map((step, idx) => (
                  <div key={idx} className="p-3 border rounded-xl bg-muted/10 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-blue-600">Step #{step.stepNumber}</span>
                      <Input
                        placeholder="Badge label"
                        value={step.badge || ""}
                        onChange={(e) => {
                          const updated = [...(cms.howItWorks?.steps || [])];
                          updated[idx].badge = e.target.value;
                          handleUpdate({ ...cms, howItWorks: { ...cms.howItWorks, steps: updated } });
                        }}
                        className="text-xs w-48"
                      />
                    </div>
                    <Input
                      placeholder="Step Title"
                      value={step.title}
                      onChange={(e) => {
                        const updated = [...(cms.howItWorks?.steps || [])];
                        updated[idx].title = e.target.value;
                        handleUpdate({ ...cms, howItWorks: { ...cms.howItWorks, steps: updated } });
                      }}
                      className="text-xs font-bold"
                    />
                    <textarea
                      rows={2}
                      placeholder="Step Description"
                      value={step.description}
                      onChange={(e) => {
                        const updated = [...(cms.howItWorks?.steps || [])];
                        updated[idx].description = e.target.value;
                        handleUpdate({ ...cms, howItWorks: { ...cms.howItWorks, steps: updated } });
                      }}
                      className="w-full p-2 text-xs rounded-lg border border-input bg-background"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Accordion 4: Comparison Matrix Manager */}
      <div className="border rounded-2xl bg-card overflow-hidden shadow-xs">
        <button
          onClick={() => toggleSection("comparison")}
          className="w-full p-4 text-left flex items-center justify-between font-bold text-sm bg-muted/30 hover:bg-muted/50 transition-colors"
        >
          <span className="flex items-center gap-2 text-foreground">
            <Layers className="h-4 w-4 text-indigo-600" />
            4. Traditional vs FlexSell Comparison Matrix
          </span>
          {activeSection === "comparison" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {activeSection === "comparison" && (
          <div className="p-5 space-y-4 border-t">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-muted-foreground">Heading</label>
                <Input
                  value={cms.comparison?.heading || ""}
                  onChange={(e) =>
                    handleUpdate({ ...cms, comparison: { ...cms.comparison, heading: e.target.value } })
                  }
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-muted-foreground">Subheading</label>
                <Input
                  value={cms.comparison?.subheading || ""}
                  onChange={(e) =>
                    handleUpdate({ ...cms, comparison: { ...cms.comparison, subheading: e.target.value } })
                  }
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-muted-foreground">Tagline</label>
                <Input
                  value={cms.comparison?.tagline || ""}
                  onChange={(e) =>
                    handleUpdate({ ...cms, comparison: { ...cms.comparison, tagline: e.target.value } })
                  }
                />
              </div>
            </div>

            {/* Matrix Image */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-muted-foreground">Matrix Image URL</label>
              <div className="flex gap-2">
                <Input
                  value={cms.comparison?.matrixImage || ""}
                  onChange={(e) =>
                    handleUpdate({ ...cms, comparison: { ...cms.comparison, matrixImage: e.target.value } })
                  }
                />
                <label className="cursor-pointer bg-secondary hover:bg-secondary/80 text-secondary-foreground px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 shrink-0">
                  <Upload className="h-3.5 w-3.5" />
                  <span>Upload</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) =>
                      handleFileUpload(e, (url) =>
                        handleUpdate({ ...cms, comparison: { ...cms.comparison, matrixImage: url } })
                      )
                    }
                  />
                </label>
              </div>
            </div>

            {/* Rows List */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase text-muted-foreground">Comparison Rows</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const newRow = {
                      feature: "New Feature",
                      traditional: "Traditional High Cost",
                      flexsell: "FlexSell Optimized Zero Cost",
                    };
                    handleUpdate({
                      ...cms,
                      comparison: {
                        ...cms.comparison,
                        rows: [...(cms.comparison?.rows || []), newRow],
                      },
                    });
                  }}
                  className="text-xs gap-1"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Row
                </Button>
              </div>

              <div className="space-y-2">
                {cms.comparison?.rows?.map((row, idx) => (
                  <div key={idx} className="p-3 border rounded-xl bg-muted/10 grid grid-cols-1 sm:grid-cols-4 gap-2 items-center">
                    <Input
                      placeholder="Feature Name"
                      value={row.feature}
                      onChange={(e) => {
                        const updated = [...(cms.comparison?.rows || [])];
                        updated[idx].feature = e.target.value;
                        handleUpdate({ ...cms, comparison: { ...cms.comparison, rows: updated } });
                      }}
                      className="text-xs font-bold"
                    />
                    <Input
                      placeholder="Traditional Model"
                      value={row.traditional}
                      onChange={(e) => {
                        const updated = [...(cms.comparison?.rows || [])];
                        updated[idx].traditional = e.target.value;
                        handleUpdate({ ...cms, comparison: { ...cms.comparison, rows: updated } });
                      }}
                      className="text-xs text-red-600"
                    />
                    <Input
                      placeholder="FlexSell Model"
                      value={row.flexsell}
                      onChange={(e) => {
                        const updated = [...(cms.comparison?.rows || [])];
                        updated[idx].flexsell = e.target.value;
                        handleUpdate({ ...cms, comparison: { ...cms.comparison, rows: updated } });
                      }}
                      className="text-xs text-emerald-600 font-medium"
                    />
                    <div className="flex justify-end">
                      <button
                        onClick={() => {
                          const updated = cms.comparison?.rows?.filter((_, i) => i !== idx) || [];
                          handleUpdate({ ...cms, comparison: { ...cms.comparison, rows: updated } });
                        }}
                        className="text-destructive hover:opacity-80 p-1"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Accordion 5: Membership Plans & Pricing Manager */}
      <div className="border rounded-2xl bg-card overflow-hidden shadow-xs">
        <button
          onClick={() => toggleSection("pricing")}
          className="w-full p-4 text-left flex items-center justify-between font-bold text-sm bg-muted/30 hover:bg-muted/50 transition-colors"
        >
          <span className="flex items-center gap-2 text-foreground">
            <CreditCard className="h-4 w-4 text-purple-600" />
            5. Membership Plans & Pricing Settings
          </span>
          {activeSection === "pricing" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {activeSection === "pricing" && (
          <div className="p-5 space-y-4 border-t">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-muted-foreground">Heading</label>
                <Input
                  value={cms.pricing?.heading || ""}
                  onChange={(e) => handleUpdate({ ...cms, pricing: { ...cms.pricing, heading: e.target.value } })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-muted-foreground">Banner Image URL</label>
                <div className="flex gap-2">
                  <Input
                    value={cms.pricing?.bannerImage || ""}
                    onChange={(e) => handleUpdate({ ...cms, pricing: { ...cms.pricing, bannerImage: e.target.value } })}
                  />
                  <label className="cursor-pointer bg-secondary hover:bg-secondary/80 text-secondary-foreground px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 shrink-0">
                    <Upload className="h-3.5 w-3.5" />
                    <span>Upload</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) =>
                        handleFileUpload(e, (url) => handleUpdate({ ...cms, pricing: { ...cms.pricing, bannerImage: url } }))
                      }
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-muted-foreground">Subheading</label>
              <Input
                value={cms.pricing?.subheading || ""}
                onChange={(e) => handleUpdate({ ...cms, pricing: { ...cms.pricing, subheading: e.target.value } })}
              />
            </div>

            {/* Categories Comma Separated */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-muted-foreground">
                Supported Fast-Selling Categories (Comma Separated)
              </label>
              <Input
                value={cms.pricing?.categories?.join(", ") || ""}
                onChange={(e) => {
                  const arr = e.target.value.split(",").map((s) => s.trim()).filter(Boolean);
                  handleUpdate({ ...cms, pricing: { ...cms.pricing, categories: arr } });
                }}
              />
            </div>

            {/* Membership Plans List */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase text-muted-foreground">Membership Plans</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const newPlan = {
                      id: `plan-${Date.now()}`,
                      name: "New Custom Plan",
                      badge: "Best Value",
                      description: "Custom admin dropshipping plan",
                      options: [
                        { duration: "3 Months Plan", price: 12000, popular: false },
                        { duration: "6 Months Plan", price: 20000, popular: true },
                      ],
                      features: [
                        "5-6 Curated High-Margin Products Listed Monthly",
                        "Bhopal 40,000 Sq Ft Warehouse Storage",
                        "Automated Inventory Updates",
                      ],
                      isActive: true,
                      order: (cms.pricing?.plans?.length || 0) + 1,
                    };
                    handleUpdate({
                      ...cms,
                      pricing: { ...cms.pricing, plans: [...(cms.pricing?.plans || []), newPlan] },
                    });
                  }}
                  className="text-xs gap-1"
                >
                  <Plus className="h-3.5 w-3.5" /> Add New Plan
                </Button>
              </div>

              <div className="space-y-4">
                {cms.pricing?.plans?.map((plan, idx) => (
                  <div key={plan.id || idx} className="p-4 border rounded-xl bg-muted/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-purple-600">Plan #{idx + 1}</span>
                      <button
                        onClick={() => {
                          const updated = cms.pricing?.plans?.filter((_, i) => i !== idx) || [];
                          handleUpdate({ ...cms, pricing: { ...cms.pricing, plans: updated } });
                        }}
                        className="text-destructive hover:opacity-80 p-1"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Input
                        placeholder="Plan Name"
                        value={plan.name}
                        onChange={(e) => {
                          const updated = [...(cms.pricing?.plans || [])];
                          updated[idx].name = e.target.value;
                          handleUpdate({ ...cms, pricing: { ...cms.pricing, plans: updated } });
                        }}
                        className="text-xs font-bold"
                      />
                      <Input
                        placeholder="Badge Label (e.g. Most Popular)"
                        value={plan.badge || ""}
                        onChange={(e) => {
                          const updated = [...(cms.pricing?.plans || [])];
                          updated[idx].badge = e.target.value;
                          handleUpdate({ ...cms, pricing: { ...cms.pricing, plans: updated } });
                        }}
                        className="text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-muted-foreground">Features (Comma Separated)</label>
                      <Input
                        value={plan.features?.join(", ") || ""}
                        onChange={(e) => {
                          const updated = [...(cms.pricing?.plans || [])];
                          updated[idx].features = e.target.value.split(",").map((s) => s.trim()).filter(Boolean);
                          handleUpdate({ ...cms, pricing: { ...cms.pricing, plans: updated } });
                        }}
                        className="text-xs"
                      />
                    </div>

                    {/* Pricing Duration Options & Amounts Editor */}
                    <div className="space-y-2 pt-2 border-t border-border/60">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-extrabold uppercase text-purple-600">Pricing Options & Amounts</span>
                        <Button
                          size="sm"
                          variant="outline"
                          type="button"
                          onClick={() => {
                            const updatedPlans = [...(cms.pricing?.plans || [])];
                            const newOption = { duration: "3 Months Plan", price: 12000, originalPrice: 15000, popular: false };
                            updatedPlans[idx].options = [...(updatedPlans[idx].options || []), newOption];
                            handleUpdate({ ...cms, pricing: { ...cms.pricing, plans: updatedPlans } });
                          }}
                          className="text-[10px] h-7 gap-1"
                        >
                          <Plus className="h-3 w-3" /> Add Duration Option
                        </Button>
                      </div>

                      <div className="space-y-2">
                        {plan.options?.map((opt, oIdx) => (
                          <div key={oIdx} className="p-2.5 rounded-lg border bg-background grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                            <div className="sm:col-span-4">
                              <label className="text-[9px] font-bold uppercase text-muted-foreground block mb-0.5">Duration Title</label>
                              <Input
                                placeholder="e.g. 3 Months Plan"
                                value={opt.duration}
                                onChange={(e) => {
                                  const updatedPlans = [...(cms.pricing?.plans || [])];
                                  updatedPlans[idx].options[oIdx].duration = e.target.value;
                                  handleUpdate({ ...cms, pricing: { ...cms.pricing, plans: updatedPlans } });
                                }}
                                className="text-xs font-bold"
                              />
                            </div>
                            <div className="sm:col-span-3">
                              <label className="text-[9px] font-bold uppercase text-muted-foreground block mb-0.5">Price Amount (₹)</label>
                              <Input
                                type="number"
                                placeholder="12000"
                                value={opt.price}
                                onChange={(e) => {
                                  const updatedPlans = [...(cms.pricing?.plans || [])];
                                  updatedPlans[idx].options[oIdx].price = parseFloat(e.target.value) || 0;
                                  handleUpdate({ ...cms, pricing: { ...cms.pricing, plans: updatedPlans } });
                                }}
                                className="text-xs font-bold text-emerald-600"
                              />
                            </div>
                            <div className="sm:col-span-3">
                              <label className="text-[9px] font-bold uppercase text-muted-foreground block mb-0.5">Original Price (₹)</label>
                              <Input
                                type="number"
                                placeholder="15000"
                                value={opt.originalPrice || ""}
                                onChange={(e) => {
                                  const updatedPlans = [...(cms.pricing?.plans || [])];
                                  updatedPlans[idx].options[oIdx].originalPrice = parseFloat(e.target.value) || undefined;
                                  handleUpdate({ ...cms, pricing: { ...cms.pricing, plans: updatedPlans } });
                                }}
                                className="text-xs"
                              />
                            </div>
                            <div className="sm:col-span-2 flex items-center justify-end pt-3">
                              <button
                                type="button"
                                onClick={() => {
                                  const updatedPlans = [...(cms.pricing?.plans || [])];
                                  updatedPlans[idx].options = updatedPlans[idx].options.filter((_, i) => i !== oIdx);
                                  handleUpdate({ ...cms, pricing: { ...cms.pricing, plans: updatedPlans } });
                                }}
                                className="text-destructive hover:opacity-80 p-1"
                                title="Remove Option"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Accordion 6 & 7: Bank & GST Details */}
      <div className="border rounded-2xl bg-card overflow-hidden shadow-xs">
        <button
          onClick={() => toggleSection("bankAndGst")}
          className="w-full p-4 text-left flex items-center justify-between font-bold text-sm bg-muted/30 hover:bg-muted/50 transition-colors"
        >
          <span className="flex items-center gap-2 text-foreground">
            <Building className="h-4 w-4 text-emerald-600" />
            6 & 7. Official Bank & GST Verification Details
          </span>
          {activeSection === "bankAndGst" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {activeSection === "bankAndGst" && (
          <div className="p-5 space-y-4 border-t">
            <div className="font-bold text-xs uppercase text-emerald-600 border-b pb-1">AXIS Bank Details</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">Company Account Name</label>
                <Input
                  value={cms.bankDetails?.accountName || ""}
                  onChange={(e) => handleUpdate({ ...cms, bankDetails: { ...cms.bankDetails, accountName: e.target.value } })}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">Bank Name</label>
                <Input
                  value={cms.bankDetails?.bankName || ""}
                  onChange={(e) => handleUpdate({ ...cms, bankDetails: { ...cms.bankDetails, bankName: e.target.value } })}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">Account Number</label>
                <Input
                  value={cms.bankDetails?.accountNumber || ""}
                  onChange={(e) => handleUpdate({ ...cms, bankDetails: { ...cms.bankDetails, accountNumber: e.target.value } })}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">IFSC Code</label>
                <Input
                  value={cms.bankDetails?.ifscCode || ""}
                  onChange={(e) => handleUpdate({ ...cms, bankDetails: { ...cms.bankDetails, ifscCode: e.target.value } })}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">Branch</label>
                <Input
                  value={cms.bankDetails?.branch || ""}
                  onChange={(e) => handleUpdate({ ...cms, bankDetails: { ...cms.bankDetails, branch: e.target.value } })}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">Account Type</label>
                <Input
                  value={cms.bankDetails?.accountType || ""}
                  onChange={(e) => handleUpdate({ ...cms, bankDetails: { ...cms.bankDetails, accountType: e.target.value } })}
                />
              </div>
            </div>

            <div className="font-bold text-xs uppercase text-purple-600 border-b pb-1 pt-3">GST & Company Identification</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">Legal Company Name</label>
                <Input
                  value={cms.gstDetails?.companyName || ""}
                  onChange={(e) => handleUpdate({ ...cms, gstDetails: { ...cms.gstDetails, companyName: e.target.value } })}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">GSTIN Number</label>
                <Input
                  value={cms.gstDetails?.gstNo || ""}
                  onChange={(e) => handleUpdate({ ...cms, gstDetails: { ...cms.gstDetails, gstNo: e.target.value } })}
                  className="font-mono text-xs font-bold text-emerald-600"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">Contact Email</label>
                <Input
                  value={cms.gstDetails?.email || ""}
                  onChange={(e) => handleUpdate({ ...cms, gstDetails: { ...cms.gstDetails, email: e.target.value } })}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Accordion 8: Shipping Slabs Settings */}
      <div className="border rounded-2xl bg-card overflow-hidden shadow-xs">
        <button
          onClick={() => toggleSection("shippingRates")}
          className="w-full p-4 text-left flex items-center justify-between font-bold text-sm bg-muted/30 hover:bg-muted/50 transition-colors"
        >
          <span className="flex items-center gap-2 text-foreground">
            <Truck className="h-4 w-4 text-emerald-600" />
            8. Shipping Rates & Weight Slabs Settings
          </span>
          {activeSection === "shippingRates" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {activeSection === "shippingRates" && (
          <div className="p-5 space-y-4 border-t">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-muted-foreground">Heading</label>
                <Input
                  value={cms.shippingRates?.heading || ""}
                  onChange={(e) => handleUpdate({ ...cms, shippingRates: { ...cms.shippingRates, heading: e.target.value } })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-muted-foreground">Subheading</label>
                <Input
                  value={cms.shippingRates?.subheading || ""}
                  onChange={(e) => handleUpdate({ ...cms, shippingRates: { ...cms.shippingRates, subheading: e.target.value } })}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-muted-foreground">Pick & Pack Note</label>
              <Input
                value={cms.shippingRates?.pickPackNote || ""}
                onChange={(e) => handleUpdate({ ...cms, shippingRates: { ...cms.shippingRates, pickPackNote: e.target.value } })}
              />
            </div>

            {/* Slabs list */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase text-muted-foreground">Weight Slabs</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const newSlab = { weightSlab: "2kg - 3kg", charge: 150 };
                    handleUpdate({
                      ...cms,
                      shippingRates: {
                        ...cms.shippingRates,
                        slabs: [...(cms.shippingRates?.slabs || []), newSlab],
                      },
                    });
                  }}
                  className="text-xs gap-1"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Weight Slab
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {cms.shippingRates?.slabs?.map((slab, idx) => (
                  <div key={idx} className="p-3 border rounded-xl bg-muted/10 space-y-2 relative">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase text-emerald-600">Slab #{idx + 1}</span>
                      <button
                        onClick={() => {
                          const updated = cms.shippingRates?.slabs?.filter((_, i) => i !== idx) || [];
                          handleUpdate({ ...cms, shippingRates: { ...cms.shippingRates, slabs: updated } });
                        }}
                        className="text-destructive hover:opacity-80 p-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <Input
                      placeholder="Weight Slab"
                      value={slab.weightSlab}
                      onChange={(e) => {
                        const updated = [...(cms.shippingRates?.slabs || [])];
                        updated[idx].weightSlab = e.target.value;
                        handleUpdate({ ...cms, shippingRates: { ...cms.shippingRates, slabs: updated } });
                      }}
                      className="text-xs font-bold"
                    />

                    <div className="flex items-center gap-1">
                      <span className="text-xs font-bold text-muted-foreground">₹</span>
                      <Input
                        type="number"
                        placeholder="Rate"
                        value={slab.charge}
                        onChange={(e) => {
                          const updated = [...(cms.shippingRates?.slabs || [])];
                          updated[idx].charge = parseFloat(e.target.value) || 0;
                          handleUpdate({ ...cms, shippingRates: { ...cms.shippingRates, slabs: updated } });
                        }}
                        className="text-xs font-bold text-emerald-600"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Accordion 9: Terms & Conditions Policy Manager */}
      <div className="border rounded-2xl bg-card overflow-hidden shadow-xs">
        <button
          onClick={() => toggleSection("terms")}
          className="w-full p-4 text-left flex items-center justify-between font-bold text-sm bg-muted/30 hover:bg-muted/50 transition-colors"
        >
          <span className="flex items-center gap-2 text-foreground">
            <FileText className="h-4 w-4 text-slate-600" />
            9. Terms & Conditions Policy Manager
          </span>
          {activeSection === "terms" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {activeSection === "terms" && (
          <div className="p-5 space-y-4 border-t">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-muted-foreground">Heading</label>
                <Input
                  value={cms.terms?.heading || ""}
                  onChange={(e) => handleUpdate({ ...cms, terms: { ...cms.terms, heading: e.target.value } })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-muted-foreground">Subheading</label>
                <Input
                  value={cms.terms?.subheading || ""}
                  onChange={(e) => handleUpdate({ ...cms, terms: { ...cms.terms, subheading: e.target.value } })}
                />
              </div>
            </div>

            {/* Policy Sections List */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase text-muted-foreground">Policy Sections (Accordion)</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const newSection = {
                      title: `${(cms.terms?.sections?.length || 0) + 1}. NEW POLICY SECTION`,
                      points: ["Policy detail point 1...", "Policy detail point 2..."],
                    };
                    handleUpdate({
                      ...cms,
                      terms: { ...cms.terms, sections: [...(cms.terms?.sections || []), newSection] },
                    });
                  }}
                  className="text-xs gap-1"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Policy Section
                </Button>
              </div>

              <div className="space-y-3">
                {cms.terms?.sections?.map((sec, idx) => (
                  <div key={idx} className="p-3 border rounded-xl bg-muted/10 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700">Section #{idx + 1}</span>
                      <button
                        onClick={() => {
                          const updated = cms.terms?.sections?.filter((_, i) => i !== idx) || [];
                          handleUpdate({ ...cms, terms: { ...cms.terms, sections: updated } });
                        }}
                        className="text-destructive hover:opacity-80 p-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <Input
                      placeholder="Section Title"
                      value={sec.title}
                      onChange={(e) => {
                        const updated = [...(cms.terms?.sections || [])];
                        updated[idx].title = e.target.value;
                        handleUpdate({ ...cms, terms: { ...cms.terms, sections: updated } });
                      }}
                      className="text-xs font-bold"
                    />

                    <textarea
                      rows={3}
                      placeholder="Policy Points (One per line)"
                      value={sec.points?.join("\n") || ""}
                      onChange={(e) => {
                        const updated = [...(cms.terms?.sections || [])];
                        updated[idx].points = e.target.value.split("\n").filter((p) => p.trim());
                        handleUpdate({ ...cms, terms: { ...cms.terms, sections: updated } });
                      }}
                      className="w-full p-2 text-xs rounded-lg border border-input bg-background font-mono"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Global Save Button */}
      <div className="flex justify-end pt-4">
        <Button
          onClick={handleSaveAll}
          disabled={isSaving}
          className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 text-white font-bold gap-2 shadow-lg shadow-purple-600/20 px-8 py-3 rounded-xl cursor-pointer text-sm"
        >
          <Save className="h-4 w-4" />
          <span>{isSaving ? "Saving All Settings..." : "Save All Dropshipping CMS Settings"}</span>
        </Button>
      </div>
    </div>
  );
}
