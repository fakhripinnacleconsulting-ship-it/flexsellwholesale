"use client";

import * as React from "react";
import Link from "next/link";
import { Category, Collection } from "@/types";
import { ChevronDown, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface MegaMenuProps {
  categories: Category[];
  collections: Collection[];
}

function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function MegaMenu({ categories, collections }: MegaMenuProps) {
  const [isCategoriesOpen, setIsCategoriesOpen] = React.useState(false);
  const [hoveredCollectionId, setHoveredCollectionId] = React.useState<string | null>(null);

  const topLevelCategories = categories.filter(c => !c.parentId).sort((a, b) => a.order - b.order);
  const activeCollections = collections.filter(c => c.isActive).sort((a, b) => a.order - b.order);

  return (
    <nav className="hidden md:flex border-t bg-secondary/30 relative z-40">
      <div className="mx-auto max-w-8xl px-4 md:px-6 h-12 flex items-center gap-7 text-sm font-semibold w-full select-none">

        {/* Categories Dropdown Trigger */}
        <div
          className="h-full flex items-center gap-1 hover:text-primary cursor-pointer transition-colors relative py-2"
          onMouseEnter={() => setIsCategoriesOpen(true)}
          onMouseLeave={() => setIsCategoriesOpen(false)}
        >
          <span className="flex items-center gap-1 font-bold text-foreground hover:text-primary text-sm">
            All Categories <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isCategoriesOpen ? "rotate-180 text-primary" : ""}`} />
          </span>

          {/* Mega Menu Dropdown with Framer Motion */}
          <AnimatePresence>
            {isCategoriesOpen && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                transition={{ duration: 0.2 }}
                className="absolute top-12 left-0 w-[920px] bg-background border border-border rounded-b-2xl shadow-xl p-6 text-foreground z-50"
              >
                <div className="grid grid-cols-4 gap-6">
                  {topLevelCategories.map((cat) => {
                    const subCats = categories.filter(c => c.parentId === cat._id).sort((a, b) => a.order - b.order);
                    return (
                      <div key={cat._id} className="space-y-2.5">
                        <Link
                          href={`/categories/${cat.slug}`}
                          className="font-bold text-base text-foreground hover:text-primary block transition-colors border-b pb-1 border-border/80"
                        >
                          {cat.name}
                        </Link>
                        {subCats.length > 0 && (
                          <ul className="space-y-1.5 text-xs text-muted-foreground">
                            {subCats.map((sub) => (
                              <li key={sub._id}>
                                <Link
                                  href={`/categories/${sub.slug}`}
                                  className="hover:text-primary block py-0.5 transition-colors"
                                >
                                  {sub.name}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Collections with Dropdown Categories - Horizontal Nav Links */}
        <div className="flex-1 flex items-center justify-between gap-6 ml-4 h-full overflow-visible">
          <div className="flex items-center gap-6 h-full py-1 text-muted-foreground overflow-visible">
            {activeCollections.map((col) => {
              // Get categories linked to this collection
              const linkedCats = categories.filter(cat => 
                col.linkedCategoryIds?.includes(cat._id)
              );

              return (
                <div
                  key={col._id}
                  className="h-full flex items-center gap-1 hover:text-primary cursor-pointer transition-colors relative py-2"
                  onMouseEnter={() => setHoveredCollectionId(col._id)}
                  onMouseLeave={() => setHoveredCollectionId(null)}
                >
                  <Link 
                    href={`/collections/${col.slug}`} 
                    className="hover:text-primary whitespace-nowrap transition-colors flex items-center gap-1 font-bold text-foreground"
                  >
                    {toTitleCase(col.title)}
                    {linkedCats.length > 0 && (
                      <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${hoveredCollectionId === col._id ? "rotate-180 text-primary" : ""}`} />
                    )}
                  </Link>

                  {/* Mega Menu Dropdown for Collection Categories */}
                  {linkedCats.length > 0 && (
                    <AnimatePresence>
                      {hoveredCollectionId === col._id && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 5 }}
                          transition={{ duration: 0.2 }}
                          className="absolute top-12 left-0 w-[680px] bg-background border border-border rounded-b-2xl shadow-xl p-5 text-foreground z-50"
                        >
                          <div className="mb-3 border-b pb-2 border-border/80">
                            <h4 className="font-bold text-sm text-primary uppercase tracking-wider">{toTitleCase(col.title)} Categories</h4>
                            <p className="text-[11px] text-muted-foreground mt-0.5">{col.description || "Curated factory direct catalog lines."}</p>
                          </div>
                          <div className="grid grid-cols-3 gap-5">
                            {linkedCats.map((cat) => {
                              const subCats = categories.filter(c => c.parentId === cat._id).sort((a, b) => a.order - b.order);
                              return (
                                <div key={cat._id} className="space-y-2">
                                  <Link
                                    href={`/categories/${cat.slug}`}
                                    className="font-bold text-xs text-foreground hover:text-primary block transition-colors border-b pb-0.5"
                                  >
                                    {cat.name}
                                  </Link>
                                  {subCats.length > 0 && (
                                    <ul className="space-y-1 text-[11px] text-muted-foreground font-medium">
                                      {subCats.slice(0, 5).map((sub) => (
                                        <li key={sub._id}>
                                          <Link
                                            href={`/categories/${sub.slug}`}
                                            className="hover:text-primary block py-0.5 transition-colors"
                                          >
                                            {sub.name}
                                          </Link>
                                        </li>
                                      ))}
                                      {subCats.length > 5 && (
                                        <li className="text-[10px] text-primary italic font-bold pt-0.5">
                                          <Link href={`/categories/${cat.slug}`}>
                                            + {subCats.length - 5} More
                                          </Link>
                                        </li>
                                      )}
                                    </ul>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  )}
                </div>
              );
            })}
          </div>

          {/* Independent Channel Links */}
          <div className="flex items-center gap-4 shrink-0 border-l pl-4 border-border h-full">
            <Link href="/products" className="hover:text-primary whitespace-nowrap font-bold text-foreground transition-colors">
              Wholesale Bulk Catalog
            </Link>
            <Link href="/dropshipping" className="bg-primary/10 hover:bg-primary/20 text-primary px-3 py-1 rounded-full whitespace-nowrap font-bold transition-colors flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5" /> Dropshipping Hub
            </Link>
          </div>
        </div>

      </div>
    </nav>
  );
}
