"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useProductForm } from "./ProductFormContext";
import { Plus, Upload, Trash2, ArrowLeft } from "lucide-react";

export function APlusContentCard() {
  const {
    aPlusBlocks,
    setAPlusBlocks,
    addAPlusBlock,
    moveAPlusBlock,
    removeAPlusBlock,
    handleBlockImageUpload,
    title
  } = useProductForm();

  return (
    <Card>
      <CardContent className="p-6 space-y-6">
        <div className="flex justify-between items-center border-b pb-2">
          <h3 className="font-bold text-lg">A+ Marketing Content (Manufacturer Banners Only)</h3>
          <Button type="button" size="sm" onClick={addAPlusBlock} className="cursor-pointer">
            <Plus className="h-4 w-4 mr-1" /> Add Image Banner
          </Button>
        </div>

        {aPlusBlocks.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No manufacturer A+ marketing banners configured.</p>
        ) : (
          <div className="border rounded-lg overflow-hidden bg-background">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-secondary/20 border-b">
                  <th className="p-2.5 font-bold w-20 text-center">Sequence</th>
                  <th className="p-2.5 font-bold w-28 text-center">Preview</th>
                  <th className="p-2.5 font-bold w-48">Aspect Sizing Format</th>
                  <th className="p-2.5 font-bold">Image Upload or Url</th>
                  <th className="p-2.5 font-bold">Alt Tag (Editable)</th>
                  <th className="p-2.5 font-bold w-12 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {aPlusBlocks.map((block, idx) => (
                  <tr key={block.id} className="border-b last:border-0 hover:bg-secondary/5">
                    <td className="p-2.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          disabled={idx === 0}
                          className="p-1 rounded bg-secondary/50 hover:bg-secondary disabled:opacity-30 disabled:hover:bg-secondary/50 transition-colors cursor-pointer"
                          onClick={() => moveAPlusBlock(idx, "up")}
                          title="Move Banner Up"
                        >
                          <ArrowLeft className="h-3 w-3 rotate-90" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === aPlusBlocks.length - 1}
                          className="p-1 rounded bg-secondary/50 hover:bg-secondary disabled:opacity-30 disabled:hover:bg-secondary/50 transition-colors cursor-pointer"
                          onClick={() => moveAPlusBlock(idx, "down")}
                          title="Move Banner Down"
                        >
                          <ArrowLeft className="h-3 w-3 -rotate-90" />
                        </button>
                      </div>
                    </td>
                    <td className="p-2.5 text-center">
                      {block.imageUrl ? (
                        <img
                          src={block.imageUrl}
                          alt={block.alt || "Banner preview"}
                          className="h-10 w-24 object-cover rounded border bg-secondary mx-auto"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1590794056226-79ef3a8147e1?auto=format&fit=crop&w=600&q=80";
                          }}
                        />
                      ) : (
                        <span className="text-[10px] text-muted-foreground italic">No image</span>
                      )}
                    </td>
                    <td className="p-2.5">
                      <select
                        className="w-full h-8 px-2 rounded border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        value={block.content}
                        onChange={(e) => setAPlusBlocks(prev => prev.map(b => b.id === block.id ? { ...b, content: e.target.value } : b))}
                      >
                        <option value="970x300">970x300 Standard</option>
                        <option value="970x600">970x600 Double-Height</option>
                      </select>
                    </td>
                    <td className="p-2.5">
                      <div className="flex flex-col gap-1.5">
                        <label className="flex items-center justify-center gap-1.5 px-2 py-1 bg-background hover:bg-secondary/50 border rounded cursor-pointer text-[10px] font-medium transition-colors w-max">
                          <Upload className="h-3 w-3 text-muted-foreground" />
                          <span>Upload File</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleBlockImageUpload(e, block.id)}
                          />
                        </label>
                        <Input
                          placeholder="Or paste absolute image url..."
                          className="text-[10px] h-7 px-2"
                          value={block.imageUrl || ""}
                          onChange={(e) => setAPlusBlocks(prev => prev.map((b, bIdx) => {
                            if (b.id === block.id) {
                              return {
                                ...b,
                                imageUrl: e.target.value,
                                alt: b.alt || `${title || "Product"} A+ Banner ${bIdx + 1}`
                              };
                            }
                            return b;
                          }))}
                        />
                      </div>
                    </td>
                    <td className="p-2.5">
                      <Input
                        placeholder="Alt description for image..."
                        className="text-[10px] h-8 px-2 w-full"
                        value={block.alt || ""}
                        onChange={(e) => setAPlusBlocks(prev => prev.map(b => b.id === block.id ? { ...b, alt: e.target.value } : b))}
                      />
                    </td>
                    <td className="p-2.5 text-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                        onClick={() => removeAPlusBlock(block.id)}
                        title="Delete Block"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
