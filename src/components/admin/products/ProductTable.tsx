import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Pagination } from "@/components/ui/Pagination";
import { Edit, Trash2, ExternalLink, Download } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { Product } from "@/types";
import { resolvePrice } from "@/lib/priceTierHelper";

interface ProductTableProps {
  isAllPageSelected: boolean;
  handleSelectAllOnPage: () => void;
  processedProducts: Product[];
  paginatedProducts: Product[];
  selectedProductIds: string[];
  handleSelectRow: (id: string) => void;
  getCategoryName: (id: string) => string;
  toggleProductActive: (id: string, status: boolean) => void;
  handleDeleteProduct: (id: string) => void;
  setBarcodePrintProduct: (p: Product) => void;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  totalPages: number;
  ITEMS_PER_PAGE: number;
}

export function ProductTable({
  isAllPageSelected,
  handleSelectAllOnPage,
  processedProducts,
  paginatedProducts,
  selectedProductIds,
  handleSelectRow,
  getCategoryName,
  toggleProductActive,
  handleDeleteProduct,
  setBarcodePrintProduct,
  currentPage,
  setCurrentPage,
  totalPages,
  ITEMS_PER_PAGE
}: ProductTableProps) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-secondary/50">
              <tr>
                <th className="px-6 py-4 w-12 text-center">
                  <input 
                    type="checkbox" 
                    className="rounded text-primary focus:ring-primary bg-background border-border cursor-pointer h-4 w-4"
                    checked={isAllPageSelected}
                    onChange={handleSelectAllOnPage}
                  />
                </th>
                <th className="px-6 py-4">Product Details</th>
                <th className="px-6 py-4 font-mono">Tax HSN</th>
                <th className="px-6 py-4">Wholesale Price</th>
                <th className="px-6 py-4">Total Stock</th>
                <th className="px-6 py-4">Active</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {processedProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-muted-foreground">
                    No matching wholesale products found. Change filters or search terms.
                  </td>
                </tr>
              ) : (
                paginatedProducts.map((product) => {
                  const defaultVariant = product.colorVariants?.[0] || { price: 0, mrp: 0, stock: 0, sku: "NO SKU", images: [] };
                  const firstImg = defaultVariant.images?.[0];
                  const imgUrl = firstImg ? (typeof firstImg === "string" ? firstImg : firstImg.url || "") : "";
                  const variantsCount = product.colorVariants?.length || 0;
                  const isSelected = selectedProductIds.includes(product._id);

                  return (
                    <tr key={product._id} className={`hover:bg-secondary/20 transition-colors ${!product.isActive ? "opacity-60" : ""} ${isSelected ? "bg-primary/5" : ""}`}>
                      <td className="px-6 py-4 text-center">
                        <input 
                          type="checkbox" 
                          className="rounded text-primary focus:ring-primary bg-background border-border cursor-pointer h-4 w-4"
                          checked={isSelected}
                          onChange={() => handleSelectRow(product._id)}
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-md bg-secondary overflow-hidden flex-shrink-0 border">
                            {imgUrl && <Image src={imgUrl} alt={product.title} width={40} height={40} className="w-full h-full object-cover" />}
                          </div>
                          <div>
                            <p className="font-bold line-clamp-1">{product.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Category: {getCategoryName(product.categoryId)} | {variantsCount} variants
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-muted-foreground">
                        {product.hsnCode ? (
                          <div>HSN {product.hsnCode} ({product.gstRate}% GST)</div>
                        ) : (
                          <span className="text-warning">Not Set</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-foreground">
                          {formatPrice(
                            defaultVariant?.subVariants?.[0] 
                              ? resolvePrice(defaultVariant.subVariants[0], product.defaultPriceTier || "B2C") 
                              : 0
                          )}
                          <span className="text-[9px] text-muted-foreground ml-1 font-semibold">
                            ({product.defaultPriceTier || "B2C"})
                          </span>
                        </div>
                        <div className="text-[10px] text-muted-foreground">MRP: {formatPrice(defaultVariant?.subVariants?.[0]?.mrp ?? 0)}</div>
                      </td>
                      <td className="px-6 py-4">
                        {product.totalStock > 20 ? (
                          <span className="bg-success/10 text-success px-2 py-0.5 rounded-full text-xs font-semibold">{product.totalStock} units</span>
                        ) : product.totalStock > 0 ? (
                          <span className="bg-warning/10 text-warning px-2 py-0.5 rounded-full text-xs font-semibold">{product.totalStock} units (Low)</span>
                        ) : (
                          <span className="bg-destructive/10 text-destructive px-2 py-0.5 rounded-full text-xs font-semibold">Out of Stock</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {/* Active / Inactive Toggle Switch */}
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={product.isActive}
                            onChange={() => toggleProductActive(product._id, product.isActive)}
                          />
                          <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                        </label>
                      </td>
                      <td className="px-6 py-4 text-right space-x-1 whitespace-nowrap">
                        {/* View in New Tab */}
                        <a href={`/products/${product.slug}`} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="icon" title="View Storefront">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </a>
                        {/* Download all barcodes sheet */}
                        <Button variant="ghost" size="icon" title="Download Barcodes" onClick={() => setBarcodePrintProduct(product)}>
                          <Download className="h-4 w-4" />
                        </Button>
                        <Link href={`/admin/products/${product._id}`}>
                          <Button variant="ghost" size="icon">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteProduct(product._id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 pb-4">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            totalItems={processedProducts.length}
            itemsPerPage={ITEMS_PER_PAGE}
          />
        </div>
      </CardContent>
    </Card>
  );
}
