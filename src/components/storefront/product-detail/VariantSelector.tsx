"use client";

import * as React from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useProductDetail } from "./ProductDetailContext";
import { Maximize2, Scale, Minus, Plus, ShoppingCart } from "lucide-react";
import { formatPrice } from "@/lib/utils";

export function VariantSelector() {
  const {
    product,
    orderMode,
    setOrderMode,
    selectedColorIdx,
    setSelectedColorIdx,
    selectedSize,
    setSelectedSize,
    selectedWeight,
    setSelectedWeight,
    qty,
    setQty,
    bulkQuantities,
    handleBulkQtyChange,
    handleAddBulkToCart,
    activeVariant,
    activeSubVariant,
    uniqueSizes,
    uniqueWeights,
    qtyInputRef
  } = useProductDetail();

  if (!product) return null;

  const colorVariants = product.colorVariants || [];
  const visibility = product.fieldVisibility || {
    showDescription: true,
    showSizes: true,
    showWeights: true,
    showDimensions: true,
    showImages: true,
  };
  const { activeUser } = useProductDetail();
  const customerTypes = activeUser?.customerTypes || ["B2C"];
  const isB2B = customerTypes.includes("B2B");
  const isB2C = customerTypes.includes("B2C");
  const isDropshipperOnly = customerTypes.length === 1 && customerTypes[0] === "Dropshipping";

  const { resolvePrice, resolveMoq, canPurchase } = require("@/lib/priceTierHelper");
  const purchaseAllowed = canPurchase(customerTypes);

  // Determine standard MOQ and active price tier for single selector
  const activeCartTier = isB2C ? "B2C" : isB2B ? "B2B" : "B2C";
  const itemMoq = activeSubVariant ? resolveMoq(activeSubVariant, activeCartTier) : 1;

  const handleAddToCart = () => {
    const { useCartStore } = require("@/stores/cartStore");
    const { useToastStore } = require("@/stores/toastStore");
    const addItem = useCartStore.getState().addItem;
    const addToast = useToastStore.getState().addToast;

    if (!activeVariant) return;
    if (!purchaseAllowed) {
      addToast("Dropshipping accounts cannot place orders directly from storefront.", "warning");
      return;
    }

    if (qty < itemMoq) {
      addToast(`Cannot add to cart. Minimum Order Quantity (MOQ) of ${itemMoq} units is required.`, "warning");
      setQty(itemMoq);
      qtyInputRef.current?.focus();
      return;
    }

    if (qty > (activeSubVariant?.stock || 0)) {
      addToast(`Cannot add to cart. Only ${activeSubVariant?.stock || 0} units are currently available.`, "warning");
      setQty(activeSubVariant?.stock || 0);
      qtyInputRef.current?.focus();
      return;
    }

    addItem(
      product,
      {
        Color: activeVariant.color,
        Size: selectedSize,
        Weight: selectedWeight
      },
      qty,
      activeCartTier
    );

    qtyInputRef.current?.focus();
    qtyInputRef.current?.select();
    addToast("Successfully added to cart!", "success");
  };

  // Tab visibility guards
  const showStandardTab = purchaseAllowed && isB2C;
  const showBulkTab = purchaseAllowed;

  // Sync active mode if the tab is hidden
  React.useEffect(() => {
    if (!showStandardTab && orderMode === "single") {
      setOrderMode("bulk");
    } else if (!showBulkTab && orderMode === "bulk") {
      setOrderMode("single");
    }
  }, [showStandardTab, showBulkTab, orderMode, setOrderMode]);

  if (isDropshipperOnly) {
    return (
      <div className="p-6 bg-secondary/15 rounded-xl border text-center space-y-2">
        <p className="text-sm font-semibold text-muted-foreground">
          Your account is configured for dropshipping.
        </p>
        <p className="text-xs text-muted-foreground">
          Dropshipping orders and invoices are managed by the admin on your behalf. Direct storefront purchasing is disabled.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* B2B Ordering Mode Selection Tabs */}
      {showStandardTab && showBulkTab && (
        <div className="flex border-b border-border mb-4">
          <button
            type="button"
            onClick={() => setOrderMode("single")}
            className={`flex-1 pb-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
              orderMode === "single"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Standard Selector
          </button>
          <button
            type="button"
            onClick={() => setOrderMode("bulk")}
            className={`flex-1 pb-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
              orderMode === "bulk"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Bulk Purchase Matrix
          </button>
        </div>
      )}

      {orderMode === "single" ? (
        <>
          {/* Color Selection Swatches */}
          {colorVariants.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-bold text-sm text-foreground uppercase tracking-wider">
                Select Option / Color:
                <span className="text-primary font-semibold ml-2">{activeVariant?.color}</span>
              </h4>
              <div className="flex flex-wrap gap-2">
                {colorVariants.map((v, idx) => {
                  const isSelected = selectedColorIdx === idx;
                  const isOutOfStock = v.subVariants?.every(sv => sv.stock === 0);
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedColorIdx(idx)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                        isSelected
                          ? "border-primary bg-primary/10 text-primary font-bold shadow-sm"
                          : "border-border hover:border-primary/50 text-muted-foreground bg-card"
                      } ${isOutOfStock ? "opacity-40 line-through cursor-not-allowed" : ""}`}
                      title={isOutOfStock ? "This option is currently out of stock" : ""}
                    >
                      {v.color}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Size Selection Swatches */}
          {visibility.showSizes && uniqueSizes.length > 0 && (
            <div className="space-y-3 pt-2">
              <h4 className="font-bold text-sm text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Maximize2 className="h-4.5 w-4.5 text-muted-foreground" />
                Select Pack Sizing:
                <span className="text-primary font-semibold ml-2">{selectedSize}</span>
              </h4>
              <div className="flex flex-wrap gap-2">
                {uniqueSizes.map((size) => {
                  const isSelected = selectedSize === size;
                  const isOutOfStock = activeVariant?.subVariants
                    ?.filter(sv => sv.size === size)
                    .every(sv => sv.stock === 0);

                  return (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setSelectedSize(size)}
                      className={`px-3.5 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer relative ${
                        isSelected
                          ? "border-primary bg-primary/10 text-primary font-bold shadow-sm"
                          : "border-border hover:border-primary/50 text-muted-foreground bg-card"
                      } ${isOutOfStock ? "opacity-40 line-through cursor-not-allowed" : ""}`}
                      title={isOutOfStock ? "This pack size option is currently out of stock" : ""}
                    >
                      {size}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Weight Selection Swatches */}
          {visibility.showWeights && uniqueWeights.length > 0 && (
            <div className="space-y-3 pt-2">
              <h4 className="font-bold text-sm text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Scale className="h-4.5 w-4.5 text-muted-foreground" />
                Select Weight Unit:
                <span className="text-primary font-semibold ml-2">{selectedWeight}</span>
              </h4>
              <div className="flex flex-wrap gap-2">
                {uniqueWeights.map((weight) => {
                  const isSelected = selectedWeight === weight;
                  const isOutOfStock = activeVariant?.subVariants
                    ?.filter(sv => sv.weight === weight)
                    .every(sv => sv.stock === 0);

                  return (
                    <button
                      key={weight}
                      type="button"
                      onClick={() => setSelectedWeight(weight)}
                      className={`px-3.5 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer relative ${
                        isSelected
                          ? "border-primary bg-primary/10 text-primary font-bold shadow-sm"
                          : "border-border hover:border-primary/50 text-muted-foreground bg-card"
                      } ${isOutOfStock ? "opacity-40 line-through cursor-not-allowed" : ""}`}
                      title={isOutOfStock ? "This weight option is currently out of stock" : ""}
                    >
                      {weight}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quantity Selector & Action buttons */}
          {activeVariant && (
            <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t items-stretch">
              <div className="flex items-center gap-2 border border-border rounded-lg p-1 bg-secondary/10 justify-between px-3 w-full sm:w-36">
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => setQty(Math.max(itemMoq, qty - 1))}
                  className="p-1 h-8 w-8 text-foreground cursor-pointer"
                  disabled={qty <= itemMoq}
                >
                  <Minus className="h-4 w-4" />
                </Button>

                {/* Quantity Input Box */}
                <input
                  ref={qtyInputRef}
                  type="number"
                  className="w-12 text-center text-sm font-extrabold bg-transparent text-foreground focus:outline-none border-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  value={qty}
                  min={itemMoq}
                  max={activeSubVariant?.stock || 0}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val)) setQty(val);
                  }}
                  onBlur={() => {
                    if (qty < itemMoq) setQty(itemMoq);
                    if (qty > (activeSubVariant?.stock || 0)) setQty(activeSubVariant?.stock || 0);
                  }}
                />

                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => setQty(Math.min(activeSubVariant?.stock || 0, qty + 1))}
                  className="p-1 h-8 w-8 text-foreground cursor-pointer"
                  disabled={qty >= (activeSubVariant?.stock || 0)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <Button
                size="lg"
                type="button"
                className="flex-1 font-bold flex items-center justify-center gap-2 shadow cursor-pointer"
                onClick={handleAddToCart}
                disabled={(activeSubVariant?.stock || 0) <= 0}
              >
                <ShoppingCart className="h-5 w-5" /> Add to Cart
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-4 pt-2">
          <h4 className="font-bold text-sm text-foreground uppercase tracking-wider">
            B2B Bulk Variant Purchase Grid:
          </h4>
          <div className="overflow-x-auto border border-border rounded-xl bg-card">
            <table className="w-full text-xs text-left">
              <thead className="bg-secondary/40 text-muted-foreground uppercase tracking-wider text-[10px] font-bold border-b border-border">
                <tr>
                  <th className="px-3 py-2.5">Color</th>
                  <th className="px-3 py-2.5">Size</th>
                  <th className="px-3 py-2.5">Weight</th>
                  <th className="px-3 py-2.5 text-right">Wholesale Price</th>
                  <th className="px-3 py-2.5 text-center">Stock</th>
                  <th className="px-3 py-2.5 text-right w-24">Order Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {product.colorVariants?.flatMap(cv =>
                  (cv.subVariants || []).filter(sv => sv.isActive !== false).map(sv => {
                    const rate = product.gstRate ?? 18;
                    const isIncl = product.priceIncludesGst ?? true;
                    
                    const bulkTier = isB2B ? "B2B" : "B2C";
                    const resolvedBasePrice = resolvePrice(sv, bulkTier);
                    const totalPrice = isIncl ? resolvedBasePrice : resolvedBasePrice * (1 + rate / 100);
                    const qtyVal = bulkQuantities[sv.id] || "";
                    const svMoq = resolveMoq(sv, bulkTier);

                    return (
                      <tr key={sv.id} className="hover:bg-secondary/10">
                        <td className="px-3 py-2.5 font-semibold">{cv.color}</td>
                        <td className="px-3 py-2.5 font-mono">{sv.size || "-"}</td>
                        <td className="px-3 py-2.5 font-mono">{sv.weight || "-"}</td>
                        <td className="px-3 py-2.5 text-right font-bold text-primary">
                          {formatPrice(totalPrice)}
                          <span className="text-[9px] text-muted-foreground block font-normal">
                            {isIncl ? "incl. GST" : "excl. GST"}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {sv.stock > svMoq * 2 ? (
                            <Badge variant="success">{sv.stock}</Badge>
                          ) : sv.stock > 0 ? (
                            <Badge variant="warning">{sv.stock}</Badge>
                          ) : (
                            <Badge variant="destructive">0</Badge>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <input
                            type="number"
                            placeholder={svMoq > 1 ? `Min ${svMoq}` : "Qty"}
                            className="w-20 text-center text-xs font-bold border border-border rounded p-1 bg-transparent text-foreground focus:outline-none focus:ring-1 focus:ring-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            disabled={sv.stock <= 0}
                            value={qtyVal}
                            onChange={(e) => handleBulkQtyChange(sv.id, e.target.value, sv.stock)}
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <Button
            size="lg"
            type="button"
            className="w-full font-bold flex items-center justify-center gap-2 shadow mt-4 cursor-pointer"
            onClick={handleAddBulkToCart}
          >
            <ShoppingCart className="h-5 w-5" /> Add Selected Variants to Cart
          </Button>
        </div>
      )}
    </div>
  );
}
