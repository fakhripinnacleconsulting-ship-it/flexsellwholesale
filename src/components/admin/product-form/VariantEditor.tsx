"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { useProductForm } from "./ProductFormContext";
import { Plus, Edit2, Trash2, Maximize2, Minimize2 } from "lucide-react";
import { useToastStore } from "@/stores/toastStore";
import { VariantCard } from "./VariantCard";

export function VariantEditor() {
  const { addToast } = useToastStore();
  const {
    variantsList,
    variantSizes,
    setVariantSizes,
    variantWeights,
    setVariantWeights,
    newImageUrl,
    setNewImageUrl,
    addVariant,
    removeVariant,
    generateSubVariants,
    updateSubVariantField,
    removeSubVariant,
    updateVariantField,
    handleVariantImageUpload,
    handleSubVariantBarcodeImageUpload,
    handleAddImageUrl,
    title
  } = useProductForm();

  const [editingIdx, setEditingIdx] = React.useState<number | null>(null);
  const [isFullScreen, setIsFullScreen] = React.useState(true);

  const handleAddVariant = () => {
    addVariant();
    setEditingIdx(variantsList.length);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center border-b pb-2">
        <h3 className="font-extrabold text-xl text-foreground">Color Variants</h3>
        <Button type="button" size="sm" onClick={handleAddVariant} className="flex items-center gap-1.5 cursor-pointer">
          <Plus className="h-4 w-4" /> Add Color Variant
        </Button>
      </div>

      {variantsList.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg bg-secondary/5">
          No color variants added yet. Click "Add Color Variant" to start.
        </div>
      ) : (
        <div className="border rounded-md overflow-hidden bg-background">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-secondary/45 text-xs font-bold uppercase text-muted-foreground border-b border-border">
              <tr>
                <th className="px-4 py-3">Color Variant</th>
                <th className="px-4 py-3">Dimensions</th>
                <th className="px-4 py-3">Sizes / Weights</th>
                <th className="px-4 py-3 text-center">Combinations</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {variantsList.map((item, idx) => {
                const derivedSizes = Array.from(new Set((item.subVariants || []).map(sv => sv.size))).filter(Boolean);
                const derivedWeights = Array.from(new Set((item.subVariants || []).map(sv => sv.weight))).filter(Boolean);
                const combCount = item.subVariants?.length || 0;

                return (
                  <tr key={idx} className="hover:bg-secondary/10 transition-colors">
                    <td className="px-4 py-3 font-semibold text-primary">{item.color || "Unnamed Color"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{item.dimensions || "N/A"}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {derivedSizes.length > 0 && <div><span className="font-semibold">Sizes:</span> {derivedSizes.join(", ")}</div>}
                      {derivedWeights.length > 0 && <div className="mt-0.5"><span className="font-semibold">Weights:</span> {derivedWeights.join(", ")}</div>}
                      {derivedSizes.length === 0 && derivedWeights.length === 0 && <span>No sizes/weights configured</span>}
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-xs">{combCount}</td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingIdx(idx)}
                        className="cursor-pointer h-8 text-xs font-semibold"
                      >
                        <Edit2 className="h-3 w-3 mr-1" /> Edit Variant
                      </Button>
                      {variantsList.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs text-destructive hover:bg-destructive/10 cursor-pointer"
                          onClick={() => removeVariant(idx)}
                        >
                          <Trash2 className="h-3 w-3 mr-1" /> Delete
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Editing Dialog Modal Overlay - Opens Only One Variant At A Time */}
      {editingIdx !== null && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 no-print">
          <div className={isFullScreen ? "fixed inset-0 bg-background z-50 flex flex-col overflow-hidden animate-in fade-in duration-200" : "bg-background border border-border rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200"}>
            {/* Modal Header */}
            <div className="p-4 border-b border-border flex items-center justify-between bg-secondary/15">
              <h3 className="font-extrabold text-sm uppercase text-primary tracking-wider">
                Variant Details Line #{editingIdx + 1}: {variantsList[editingIdx]?.color || "New Color"}
              </h3>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsFullScreen(prev => !prev)}
                  className="font-bold text-xs cursor-pointer flex items-center gap-1.5"
                >
                  {isFullScreen ? (
                    <>
                      <Minimize2 className="h-3.5 w-3.5" /> Normal Screen
                    </>
                  ) : (
                    <>
                      <Maximize2 className="h-3.5 w-3.5" /> Full Screen
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditingIdx(null);
                    setIsFullScreen(true);
                  }}
                  className="font-bold text-xs cursor-pointer"
                >
                  Close & Keep
                </Button>
              </div>
            </div>
            {/* Modal Scrollable Content */}
            <div className="p-6 overflow-y-auto flex-1">
              {(() => {
                const item = variantsList[editingIdx];
                if (!item) return null;
                const derivedSizes = Array.from(new Set((item.subVariants || []).map(sv => sv.size))).filter(Boolean).join(", ");
                const derivedWeights = Array.from(new Set((item.subVariants || []).map(sv => sv.weight))).filter(Boolean).join(", ");
                const currentSizes = variantSizes[editingIdx] !== undefined ? variantSizes[editingIdx] : derivedSizes;
                const currentWeights = variantWeights[editingIdx] !== undefined ? variantWeights[editingIdx] : derivedWeights;

                return (
                  <VariantCard
                    idx={editingIdx}
                    item={item}
                    title={title}
                    variantsListLength={variantsList.length}
                    currentSizes={currentSizes}
                    currentWeights={currentWeights}
                    newImageUrl={newImageUrl[editingIdx]}
                    removeVariant={(idx) => {
                      removeVariant(idx);
                      setEditingIdx(null);
                      setIsFullScreen(true);
                    }}
                    updateVariantField={updateVariantField}
                    setVariantSizes={setVariantSizes}
                    setVariantWeights={setVariantWeights}
                    setNewImageUrl={setNewImageUrl}
                    generateSubVariants={generateSubVariants}
                    updateSubVariantField={updateSubVariantField}
                    removeSubVariant={removeSubVariant}
                    handleVariantImageUpload={handleVariantImageUpload}
                    handleSubVariantBarcodeImageUpload={handleSubVariantBarcodeImageUpload}
                    handleAddImageUrl={handleAddImageUrl}
                    addToast={addToast}
                  />
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
