"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToastStore } from "@/stores/toastStore";
import { Trash2, Plus, Scale, Truck, Save, Pencil } from "lucide-react";
import { shippingService } from "@/services/shippingService";
import { ShippingWeightSlab } from "@/types";
import { ErrorState } from "@/components/ui/ErrorState";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/Dialog";

export default function AdminShippingPage() {
  const { addToast } = useToastStore();
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [b2bFixedCharge, setB2bFixedCharge] = React.useState(150);
  const [dropshippingFixedCharge, setDropshippingFixedCharge] = React.useState(80);
  const [slabs, setSlabs] = React.useState<ShippingWeightSlab[]>([]);
  const [activeTab, setActiveTab] = React.useState<"weight" | "b2b">("weight");

  // Add slab form states
  const [newFromGram, setNewFromGram] = React.useState("");
  const [newUptoGram, setNewUptoGram] = React.useState("");
  const [newAmount, setNewAmount] = React.useState("");

  // Edit slab modal states
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
  const [editingIndex, setEditingIndex] = React.useState<number | null>(null);
  const [editFromGram, setEditFromGram] = React.useState("");
  const [editUptoGram, setEditUptoGram] = React.useState("");
  const [editAmount, setEditAmount] = React.useState("");

  React.useEffect(() => {
    shippingService.getConfig()
      .then((config: any) => {
        if (config) {
          setB2bFixedCharge(config.b2bFixedCharge ?? 150);
          setDropshippingFixedCharge(config.dropshippingFixedCharge ?? 80);
          setSlabs(config.weightSlabs || []);
        }
      })
      .catch((err) => {
        console.error(err);
        setError(err.message || "Failed to load shipping settings");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [addToast]);

  const handleAddSlab = (e: React.FormEvent) => {
    e.preventDefault();
    const fromVal = Number(newFromGram);
    const uptoVal = Number(newUptoGram);
    const amountVal = Number(newAmount);

    if (isNaN(fromVal) || fromVal < 0) {
      addToast("Start range must be a valid positive number.", "warning");
      return;
    }
    if (isNaN(uptoVal) || uptoVal <= fromVal) {
      addToast("Upto range must be greater than start range.", "warning");
      return;
    }
    if (isNaN(amountVal) || amountVal < 0) {
      addToast("Shipping amount must be a positive number.", "warning");
      return;
    }

    const overlaps = slabs.some(
      (s) =>
        (fromVal >= s.fromGram && fromVal <= s.uptoGram) ||
        (uptoVal >= s.fromGram && uptoVal <= s.uptoGram) ||
        (fromVal <= s.fromGram && uptoVal >= s.uptoGram)
    );

    if (overlaps) {
      addToast("Weight range overlaps with an existing slab.", "warning");
      return;
    }

    const newSlab: ShippingWeightSlab = {
      fromGram: fromVal,
      uptoGram: uptoVal,
      amount: amountVal,
    };

    setSlabs(prev => [...prev, newSlab].sort((a, b) => a.fromGram - b.fromGram));
    setNewFromGram("");
    setNewUptoGram("");
    setNewAmount("");
    addToast("Shipping slab added. Remember to save changes.", "info");
  };

  const handleOpenEditSlab = (index: number) => {
    const slabToEdit = slabs[index];
    if (!slabToEdit) return;

    setEditingIndex(index);
    setEditFromGram(String(slabToEdit.fromGram));
    setEditUptoGram(String(slabToEdit.uptoGram));
    setEditAmount(String(slabToEdit.amount));
    setIsEditModalOpen(true);
  };

  const handleSaveEditSlab = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingIndex === null) return;

    const fromVal = Number(editFromGram);
    const uptoVal = Number(editUptoGram);
    const amountVal = Number(editAmount);

    if (isNaN(fromVal) || fromVal < 0) {
      addToast("Start range must be a valid positive number.", "warning");
      return;
    }
    if (isNaN(uptoVal) || uptoVal <= fromVal) {
      addToast("Upto range must be greater than start range.", "warning");
      return;
    }
    if (isNaN(amountVal) || amountVal < 0) {
      addToast("Shipping amount must be a positive number.", "warning");
      return;
    }

    // Check overlaps excluding current slab
    const overlaps = slabs.some(
      (s, idx) =>
        idx !== editingIndex &&
        ((fromVal >= s.fromGram && fromVal <= s.uptoGram) ||
          (uptoVal >= s.fromGram && uptoVal <= s.uptoGram) ||
          (fromVal <= s.fromGram && uptoVal >= s.uptoGram))
    );

    if (overlaps) {
      addToast("Weight range overlaps with an existing slab.", "warning");
      return;
    }

    setSlabs(prev => {
      const updated = prev.map((s, idx) =>
        idx === editingIndex
          ? { fromGram: fromVal, uptoGram: uptoVal, amount: amountVal }
          : s
      );
      return updated.sort((a, b) => a.fromGram - b.fromGram);
    });

    setIsEditModalOpen(false);
    setEditingIndex(null);
    addToast("Shipping slab updated. Remember to save changes.", "info");
  };

  const handleRemoveSlab = (index: number) => {
    setSlabs(prev => prev.filter((_, i) => i !== index));
    addToast("Shipping slab removed. Remember to save changes.", "info");
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await shippingService.updateConfig({
        weightSlabs: slabs,
        b2bFixedCharge: Number(b2bFixedCharge),
        dropshippingFixedCharge: Number(dropshippingFixedCharge)
      } as any);
      addToast("Shipping configuration updated successfully!", "success");
    } catch (err: any) {
      addToast(err.message || "Failed to save shipping settings", "error");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="text-center py-12 text-muted-foreground">Loading shipping settings...</div>;
  }

  if (error) {
    return <div className="p-8"><ErrorState title="Failed to load shipping settings" description={error} onRetry={() => window.location.reload()} /></div>;
  }

  return (
    <div className="space-y-6 container mx-auto px-4 py-8 text-foreground max-w-5xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Shipping Charges</h1>
          <p className="text-muted-foreground mt-1">Configure weight-based and B2B shipping rates.</p>
        </div>
        <Button onClick={handleSave} disabled={isSaving} className="font-bold flex items-center gap-2 cursor-pointer">
          <Save className="h-4 w-4" /> {isSaving ? "Saving..." : "Save Configuration"}
        </Button>
      </div>

      {/* Tabs list */}
      <div className="flex border-b border-border text-sm font-bold gap-6">
        <button
          onClick={() => setActiveTab("weight")}
          className={`pb-3 transition-all border-b-2 -mb-[2px] cursor-pointer ${activeTab === "weight"
            ? "border-primary text-primary"
            : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
        >
          Weight-Based Slabs (B2C & Dropshipping)
        </button>
        <button
          onClick={() => setActiveTab("b2b")}
          className={`pb-3 transition-all border-b-2 -mb-[2px] cursor-pointer ${activeTab === "b2b"
            ? "border-primary text-primary"
            : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
        >
          B2B Order Shipping
        </button>
      </div>

      <div>
        {activeTab === "weight" ? (
          <Card className="border border-border">
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Scale className="h-5 w-5 text-primary" /> Weight-Based Slabs (B2C & Dropshipping)
              </CardTitle>
              <CardDescription>Define shipping charges based on total package weight in grams.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {slabs.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground bg-secondary/15 rounded-xl border border-dashed">
                  No weight slabs configured. Shipping will default to Free Shipping.
                </div>
              ) : (
                <div className="overflow-x-auto border rounded-lg bg-card">
                  <table className="w-full text-sm text-left whitespace-nowrap">
                    <thead className="bg-secondary/40 text-xs uppercase font-bold text-muted-foreground border-b">
                      <tr>
                        <th className="px-4 py-3">Start Range (g)</th>
                        <th className="px-4 py-3">Upto Range (g)</th>
                        <th className="px-4 py-3">Amount (₹)</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {slabs.map((slab, idx) => (
                        <tr key={idx} className="hover:bg-secondary/10 transition-colors">
                          <td className="px-4 py-3.5 font-mono">{slab.fromGram} g</td>
                          <td className="px-4 py-3.5 font-mono">{slab.uptoGram} g</td>
                          <td className="px-4 py-3.5 font-bold text-emerald-600 dark:text-emerald-400">₹{slab.amount}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenEditSlab(idx)}
                                className="text-primary hover:bg-primary/10 h-8 w-8 cursor-pointer"
                                title="Edit Slab"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveSlab(idx)}
                                className="text-destructive hover:bg-destructive/10 h-8 w-8 cursor-pointer"
                                title="Delete Slab"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Add Slab Sub-form */}
              <form onSubmit={handleAddSlab} className="p-4 bg-secondary/10 rounded-xl border border-border/40 space-y-4">
                <h4 className="text-xs font-extrabold uppercase text-muted-foreground tracking-wider">Add New Shipping Slab</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold">Start Weight (grams)</label>
                    <Input
                      type="number"
                      placeholder="e.g. 0"
                      value={newFromGram}
                      onChange={(e) => setNewFromGram(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold">Upto Weight (grams)</label>
                    <Input
                      type="number"
                      placeholder="e.g. 500"
                      value={newUptoGram}
                      onChange={(e) => setNewUptoGram(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold">Shipping Amount (₹)</label>
                    <Input
                      type="number"
                      placeholder="e.g. 50"
                      value={newAmount}
                      onChange={(e) => setNewAmount(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <Button type="submit" size="sm" variant="secondary" className="font-bold flex items-center gap-1.5 cursor-pointer">
                  <Plus className="h-3.5 w-3.5" /> Add Weight Slab
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : activeTab === "b2b" ? (
          <Card className="border border-border">
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Truck className="h-5 w-5 text-primary" /> B2B Shipping
              </CardTitle>
              <CardDescription>Set flat shipping rates for bulk trade orders.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-bold">B2B Fixed Freight Charge (₹)</label>
                <Input
                  type="number"
                  min={0}
                  value={b2bFixedCharge}
                  onChange={(e) => setB2bFixedCharge(Math.max(0, Number(e.target.value)))}
                  className="font-bold text-lg max-w-xs"
                />
                <p className="text-[10px] text-muted-foreground leading-relaxed mt-1">
                  This flat freight rate is automatically applied to all B2B wholesale bulk orders at checkout and in product cost breakdowns.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>

      {/* Edit Weight Slab Dialog */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-primary" /> Edit Shipping Weight Slab
            </DialogTitle>
            <DialogDescription>
              Update the weight range in grams and shipping charge in rupees.
            </DialogDescription>
            <DialogClose onClick={() => setIsEditModalOpen(false)} />
          </DialogHeader>
          <form onSubmit={handleSaveEditSlab} className="p-6 space-y-4">
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold">Start Weight (grams)</label>
                <Input
                  type="number"
                  placeholder="e.g. 0"
                  value={editFromGram}
                  onChange={(e) => setEditFromGram(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold">Upto Weight (grams)</label>
                <Input
                  type="number"
                  placeholder="e.g. 500"
                  value={editUptoGram}
                  onChange={(e) => setEditUptoGram(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold">Shipping Amount (₹)</label>
                <Input
                  type="number"
                  placeholder="e.g. 50"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  required
                />
              </div>
            </div>
            <DialogFooter className="p-0 pt-4 border-t gap-2 flex-row justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditModalOpen(false)}
                className="cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="font-bold cursor-pointer"
              >
                Update Slab
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
