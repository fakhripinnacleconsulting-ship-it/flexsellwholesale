"use client";

import * as React from "react";
import { X, Upload, Maximize2, Minimize2, Star, User, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import dynamic from "next/dynamic";
import { CmsTabType } from "../types";

const RichTextEditor = dynamic(() => import("@/components/admin/RichTextEditor"), {
  ssr: false,
  loading: () => (
    <div className="min-h-[300px] bg-secondary/10 border border-input rounded-md flex items-center justify-center text-muted-foreground text-sm font-medium">
      Loading editor...
    </div>
  ),
});

interface CmsFormModalProps {
  isOpen: boolean;
  activeTab: CmsTabType;
  editingIndex: number | null;
  formData: any;
  setFormData: React.Dispatch<React.SetStateAction<any>>;
  onClose: () => void;
  onSave: () => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>, fieldName: string) => void;
}

export function CmsFormModal({
  isOpen,
  activeTab,
  editingIndex,
  formData,
  setFormData,
  onClose,
  onSave,
  onFileUpload
}: CmsFormModalProps) {
  const [isFullScreen, setIsFullScreen] = React.useState(true);

  if (!isOpen) return null;

  const isWideTab = activeTab === "blogs" || activeTab === "dropship_page" || activeTab === "testimonials";
  const useFullScreen = isFullScreen || isWideTab;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
      <div
        className={`bg-card border border-border transition-all duration-300 flex flex-col shadow-2xl animate-fade-in text-foreground ${
          useFullScreen
            ? "w-[98vw] h-[95vh] max-w-none rounded-2xl"
            : "w-full max-w-3xl max-h-[90vh] rounded-2xl"
        }`}
      >
        {/* Header */}
        <div className="flex justify-between items-center border-b px-6 py-4 shrink-0">
          <div className="flex items-center gap-2">
            <h3 className="font-extrabold text-base sm:text-lg">
              {editingIndex === null ? "Add New CMS Entry" : "Edit CMS Entry"} ({activeTab.toUpperCase()})
            </h3>
            {useFullScreen && (
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                Full Screen Dialog
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="p-1.5 hover:bg-secondary rounded-lg text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              title={useFullScreen ? "Restore Normal Window" : "Expand Fullscreen Dialog"}
            >
              {useFullScreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 hover:bg-secondary rounded-lg text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Hero Banner Fields */}
          {activeTab === "hero" && (
            <>
              <div className="space-y-1">
                <label className="font-bold text-foreground">Media Type *</label>
                <select
                  value={formData.mediaType || "image"}
                  onChange={(e) => setFormData({ ...formData, mediaType: e.target.value })}
                  className="w-full h-9 rounded-lg border border-input bg-background px-3 text-xs font-semibold"
                >
                  <option value="image">Image Banner</option>
                  <option value="video">Video Banner (Performance Optimized MP4 / WebM)</option>
                </select>
              </div>

              {(formData.mediaType === "video") ? (
                <>
                  <div className="space-y-1">
                    <label className="font-bold">Desktop Video URL / Upload *</label>
                    <div className="flex gap-2">
                      <Input placeholder="https://... /video.mp4" value={formData.videoUrl || ""} onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })} className="text-xs" />
                      <label className="px-3 py-1.5 bg-secondary hover:bg-secondary/80 border rounded cursor-pointer font-bold flex items-center gap-1 shrink-0">
                        <Upload className="h-3.5 w-3.5" /> Upload Video
                        <input type="file" accept="video/*" className="hidden" onChange={(e) => onFileUpload(e, "videoUrl")} />
                      </label>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold">Mobile Video URL (Optional)</label>
                    <div className="flex gap-2">
                      <Input placeholder="Mobile video URL..." value={formData.mobileVideoUrl || ""} onChange={(e) => setFormData({ ...formData, mobileVideoUrl: e.target.value })} className="text-xs" />
                      <label className="px-3 py-1.5 bg-secondary hover:bg-secondary/80 border rounded cursor-pointer font-bold flex items-center gap-1 shrink-0">
                        <Upload className="h-3.5 w-3.5" /> Upload
                        <input type="file" accept="video/*" className="hidden" onChange={(e) => onFileUpload(e, "mobileVideoUrl")} />
                      </label>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold">Poster Thumbnail Image URL / Upload (Required for Fast FCP Paint)</label>
                    <div className="flex gap-2">
                      <Input placeholder="Poster thumbnail URL..." value={formData.posterUrl || formData.imageUrl || ""} onChange={(e) => setFormData({ ...formData, posterUrl: e.target.value, imageUrl: e.target.value })} className="text-xs" />
                      <label className="px-3 py-1.5 bg-secondary hover:bg-secondary/80 border rounded cursor-pointer font-bold flex items-center gap-1 shrink-0">
                        <Upload className="h-3.5 w-3.5" /> Upload Image
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => onFileUpload(e, "posterUrl")} />
                      </label>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-1">
                    <label className="font-bold">Desktop Image URL / Upload *</label>
                    <div className="flex gap-2">
                      <Input value={formData.imageUrl || ""} onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })} className="text-xs" />
                      <label className="px-3 py-1.5 bg-secondary hover:bg-secondary/80 border rounded cursor-pointer font-bold flex items-center gap-1 shrink-0">
                        <Upload className="h-3.5 w-3.5" /> Upload
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => onFileUpload(e, "imageUrl")} />
                      </label>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold">Mobile Image URL (Optional)</label>
                    <div className="flex gap-2">
                      <Input value={formData.mobileImageUrl || ""} onChange={(e) => setFormData({ ...formData, mobileImageUrl: e.target.value })} className="text-xs" />
                      <label className="px-3 py-1.5 bg-secondary hover:bg-secondary/80 border rounded cursor-pointer font-bold flex items-center gap-1 shrink-0">
                        <Upload className="h-3.5 w-3.5" /> Upload
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => onFileUpload(e, "mobileImageUrl")} />
                      </label>
                    </div>
                  </div>
                </>
              )}

              <div className="space-y-1 border-t pt-2 mt-2">
                <label className="font-bold text-primary">Text Overlay Title (Optional)</label>
                <Input placeholder="e.g. Direct Factory Wholesale Supply" value={formData.overlayTitle || ""} onChange={(e) => setFormData({ ...formData, overlayTitle: e.target.value })} className="text-xs" />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-primary">Text Overlay Subtitle (Optional)</label>
                <Input placeholder="e.g. Lowest factory rates & fast dispatch from Bhopal Central Warehouse" value={formData.overlaySubtitle || ""} onChange={(e) => setFormData({ ...formData, overlaySubtitle: e.target.value })} className="text-xs" />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="font-bold">CTA Button Label</label>
                  <Input placeholder="e.g. Shop Now" value={formData.ctaText || ""} onChange={(e) => setFormData({ ...formData, ctaText: e.target.value })} className="text-xs" />
                </div>
                <div className="space-y-1">
                  <label className="font-bold">Redirect URL *</label>
                  <Input value={formData.redirectUrl || "/products"} onChange={(e) => setFormData({ ...formData, redirectUrl: e.target.value })} className="text-xs" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold">Alt Text (SEO)</label>
                <Input value={formData.altText || ""} onChange={(e) => setFormData({ ...formData, altText: e.target.value })} className="text-xs" />
              </div>
            </>
          )}

          {/* Announcement Fields */}
          {activeTab === "announcements" && (
            <div className="space-y-1">
              <label className="font-bold">Announcement Text Notice *</label>
              <Input value={formData.text || ""} onChange={(e) => setFormData({ text: e.target.value })} className="text-xs" />
            </div>
          )}

          {/* Trust Stat Fields */}
          {activeTab === "trust" && (
            <>
              <div className="space-y-1">
                <label className="font-bold">Icon Key (package / truck / map-pin / users) *</label>
                <Input value={formData.icon || "package"} onChange={(e) => setFormData({ ...formData, icon: e.target.value })} className="text-xs" />
              </div>
              <div className="space-y-1">
                <label className="font-bold">Count Display (e.g. 5,000+) *</label>
                <Input value={formData.count || ""} onChange={(e) => setFormData({ ...formData, count: e.target.value })} className="text-xs" />
              </div>
              <div className="space-y-1">
                <label className="font-bold">Label Text *</label>
                <Input value={formData.label || ""} onChange={(e) => setFormData({ ...formData, label: e.target.value })} className="text-xs" />
              </div>
            </>
          )}

          {/* Business Cards */}
          {(activeTab === "wholesale_biz" || activeTab === "dropship_biz") && (
            <>
              <div className="space-y-1">
                <label className="font-bold">Icon Name *</label>
                <Input value={formData.icon || "package"} onChange={(e) => setFormData({ ...formData, icon: e.target.value })} className="text-xs" />
              </div>
              <div className="space-y-1">
                <label className="font-bold">Card Title *</label>
                <Input value={formData.title || ""} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className="text-xs" />
              </div>
              <div className="space-y-1">
                <label className="font-bold">Highlight Badge Text</label>
                <Input value={formData.badge || ""} onChange={(e) => setFormData({ ...formData, badge: e.target.value })} className="text-xs" />
              </div>
              <div className="space-y-1">
                <label className="font-bold">Description *</label>
                <textarea rows={3} className="w-full p-2 text-xs border rounded bg-background" value={formData.desc || ""} onChange={(e) => setFormData({ ...formData, desc: e.target.value })} />
              </div>
            </>
          )}

          {/* Testimonials (Customer Reviews) Form */}
          {activeTab.startsWith("testimonials") && (
            <div className="space-y-4">
              {/* Star Rating Selection */}
              <div className="space-y-1.5 p-3 rounded-xl border border-amber-500/30 bg-amber-500/5">
                <label className="font-bold text-xs text-foreground flex items-center justify-between">
                  <span>Star Rating (1 to 5 Stars) *</span>
                  <span className="text-amber-500 font-extrabold text-xs">
                    {formData.rating || 5} Out of 5 Stars
                  </span>
                </label>
                <div className="flex items-center gap-2 pt-1">
                  {[1, 2, 3, 4, 5].map((starVal) => {
                    const isSelected = (formData.rating || 5) >= starVal;
                    return (
                      <button
                        key={starVal}
                        type="button"
                        onClick={() => setFormData({ ...formData, rating: starVal })}
                        className="p-1 hover:scale-110 transition-transform cursor-pointer"
                        title={`${starVal} Star${starVal > 1 ? "s" : ""}`}
                      >
                        <Star
                          className={`h-7 w-7 ${
                            isSelected
                              ? "fill-amber-400 text-amber-400 drop-shadow-xs"
                              : "text-muted-foreground/30 hover:text-amber-300"
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Reviewer Name & Business Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-xs">Reviewer Name *</label>
                  <Input
                    placeholder="e.g. Rajesh Sharma"
                    value={formData.name || ""}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="text-xs"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-xs">Business / Store Name</label>
                  <Input
                    placeholder="e.g. Sharma Electronics & Traders"
                    value={formData.business || ""}
                    onChange={(e) => setFormData({ ...formData, business: e.target.value })}
                    className="text-xs"
                  />
                </div>
              </div>

              {/* Role Badge & Location */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-xs">Reviewer Role / Sub-Badge Label</label>
                  <Input
                    placeholder="e.g. Verified Wholesale Buyer / Retailer"
                    value={formData.roleBadge || ""}
                    onChange={(e) => setFormData({ ...formData, roleBadge: e.target.value })}
                    className="text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-xs">Location / City</label>
                  <Input
                    placeholder="e.g. Indore, MP"
                    value={formData.location || ""}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="text-xs"
                  />
                </div>
              </div>

              {/* Content Format & Avatar Upload */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-xs">Content Format</label>
                  <select
                    value={formData.contentType || "text"}
                    onChange={(e) => setFormData({ ...formData, contentType: e.target.value })}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs font-medium"
                  >
                    <option value="text">Text Only</option>
                    <option value="image">With Photo Review</option>
                    <option value="video">With Video Review</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-xs">Reviewer Avatar / Profile Photo</label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Image URL or upload photo..."
                      value={formData.avatarUrl || ""}
                      onChange={(e) => setFormData({ ...formData, avatarUrl: e.target.value })}
                      className="text-xs"
                    />
                    <label className="px-3 py-1.5 bg-secondary hover:bg-secondary/80 border rounded-md cursor-pointer font-bold flex items-center gap-1 shrink-0 text-xs">
                      <Upload className="h-3.5 w-3.5" /> Upload
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => onFileUpload(e, "avatarUrl")}
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Media File Upload (If Image or Video format) */}
              {formData.contentType !== "text" && (
                <div className="space-y-1 border-t pt-3">
                  <label className="font-bold text-xs text-primary">
                    {formData.contentType === "image" ? "Photo Review Image Upload / URL *" : "Video Review Video Upload / URL *"}
                  </label>
                  <div className="flex gap-2">
                    <Input
                      placeholder={formData.contentType === "image" ? "https://... /photo.jpg" : "https://... /video.mp4"}
                      value={formData.mediaUrl || ""}
                      onChange={(e) => setFormData({ ...formData, mediaUrl: e.target.value })}
                      className="text-xs"
                    />
                    <label className="px-3 py-1.5 bg-secondary hover:bg-secondary/80 border rounded-md cursor-pointer font-bold flex items-center gap-1 shrink-0 text-xs">
                      <Upload className="h-3.5 w-3.5" /> Upload File
                      <input
                        type="file"
                        accept={formData.contentType === "image" ? "image/*" : "video/*"}
                        className="hidden"
                        onChange={(e) => onFileUpload(e, "mediaUrl")}
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* Review Content / Comment Text */}
              <div className="space-y-1">
                <label className="font-bold text-xs">Review Content / Customer Comment *</label>
                <textarea
                  rows={3}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder="e.g. Direct Bhopal warehouse wholesale pricing gave me a 35% margin boost..."
                  value={formData.text || ""}
                  onChange={(e) => setFormData({ ...formData, text: e.target.value })}
                  required
                />
              </div>

              {/* Display Status Toggle */}
              <div className="flex items-center gap-2 pt-2 border-t">
                <input
                  type="checkbox"
                  id="testimonial-active"
                  checked={formData.isActive !== false}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="h-4 w-4 rounded border-input text-primary focus:ring-primary cursor-pointer"
                />
                <label htmlFor="testimonial-active" className="text-xs font-bold text-foreground cursor-pointer">
                  Display on Live Storefront (Active Status)
                </label>
              </div>
            </div>
          )}

          {/* Brand Partner */}
          {activeTab === "partners" && (
            <>
              <div className="space-y-1">
                <label className="font-bold">Partner / Brand Name *</label>
                <Input value={formData.name || ""} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="text-xs" />
              </div>
              <div className="space-y-1">
                <label className="font-bold text-primary">Website URL (Optional)</label>
                <Input placeholder="https://partner-website.com" value={formData.websiteUrl || ""} onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })} className="text-xs" />
              </div>
              <div className="space-y-1">
                <label className="font-bold">Logo URL / Upload *</label>
                <div className="flex gap-2">
                  <Input value={formData.logoUrl || ""} onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })} className="text-xs" />
                  <label className="px-3 py-1.5 bg-secondary border rounded cursor-pointer font-bold flex items-center gap-1 shrink-0">
                    <Upload className="h-3.5 w-3.5" /> Upload
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => onFileUpload(e, "logoUrl")} />
                  </label>
                </div>
              </div>
            </>
          )}

          {/* FAQ Fields */}
          {activeTab === "faqs" && (
            <>
              <div className="space-y-1">
                <label className="font-bold">Question *</label>
                <Input value={formData.question || ""} onChange={(e) => setFormData({ ...formData, question: e.target.value })} className="text-xs" />
              </div>
              <div className="space-y-1">
                <label className="font-bold">Category</label>
                <Input value={formData.category || "General"} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="text-xs" />
              </div>
              <div className="space-y-1">
                <label className="font-bold">Answer *</label>
                <textarea rows={4} className="w-full p-2.5 text-xs border rounded bg-background" value={formData.answer || ""} onChange={(e) => setFormData({ ...formData, answer: e.target.value })} />
              </div>
            </>
          )}

          {/* Blogs & Articles Fields */}
          {activeTab === "blogs" && (
            <>
              <div className="space-y-1">
                <label className="font-bold">Article Title *</label>
                <Input
                  value={formData.title || ""}
                  onChange={(e) => {
                    const title = e.target.value;
                    const generatedSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
                    setFormData({
                      ...formData,
                      title,
                      slug: formData.slug ? formData.slug : generatedSlug
                    });
                  }}
                  placeholder="e.g. 10 Wholesale Trends in B2B E-commerce for 2026"
                  className="text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold">URL Slug *</label>
                  <Input
                    value={formData.slug || ""}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    placeholder="wholesale-b2b-trends-2026"
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold">Category</label>
                  <Input
                    value={formData.category || ""}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="e.g. Industry News"
                    className="text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold">Author</label>
                  <Input
                    value={formData.author || ""}
                    onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                    placeholder="e.g. Flexsell Editorial Team"
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold">Publication Status</label>
                  <select
                    value={formData.isActive !== false ? "published" : "draft"}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.value === "published" })}
                    className="w-full h-9 rounded border border-input bg-background px-2 text-xs font-semibold"
                  >
                    <option value="published">Published</option>
                    <option value="draft">Draft</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold">Cover Image URL / Upload</label>
                <div className="flex gap-2">
                  <Input
                    value={formData.coverImage || ""}
                    onChange={(e) => setFormData({ ...formData, coverImage: e.target.value })}
                    placeholder="https://images.unsplash.com/..."
                    className="text-xs"
                  />
                  <label className="px-3 py-1.5 bg-secondary border rounded cursor-pointer font-bold flex items-center gap-1 shrink-0">
                    <Upload className="h-3.5 w-3.5" /> Upload
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => onFileUpload(e, "coverImage")} />
                  </label>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold">Article Summary / Excerpt *</label>
                <textarea
                  rows={2}
                  className="w-full p-2.5 text-xs border rounded bg-background"
                  placeholder="Brief summary displayed on blog list cards..."
                  value={formData.excerpt || ""}
                  onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold block">Full Article Content (Rich Formatting) *</label>
                <RichTextEditor
                  key={editingIndex === null ? "new-blog-editor" : `edit-blog-${editingIndex}`}
                  value={formData.content || ""}
                  onChange={(val) => {
                    const textOnly = val.replace(/<[^>]*>/g, "").trim();
                    const words = textOnly ? textOnly.split(/\s+/).length : 0;
                    const mins = Math.max(1, Math.ceil(words / 200));
                    setFormData((prev: any) => ({
                      ...prev,
                      content: val,
                      readTime: `${mins} min read`
                    }));
                  }}
                  placeholder="Write complete article content with headings, images, and rich formatting..."
                />
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 border-t px-6 py-3.5 shrink-0 bg-muted/10 rounded-b-2xl">
          <Button type="button" variant="outline" onClick={onClose} className="font-semibold">
            Cancel
          </Button>
          <Button type="button" onClick={onSave} className="font-bold shadow-md">
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}
