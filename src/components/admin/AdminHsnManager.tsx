"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useHsnStore } from "@/stores/hsnStore";
import { Search, Plus, Edit, Trash2, Percent, CheckCircle, XCircle } from "lucide-react";
import { useToastStore } from "@/stores/toastStore";
import { useConfirmStore } from "@/stores/confirmStore";

const INDIAN_STATES = [
  "Madhya Pradesh",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Delhi"
];

export function AdminHsnManager() {
  const { hsns, supplierState, initializeHsns, addHsn, updateHsn, deleteHsn, setSupplierState } = useHsnStore();
  const { addToast } = useToastStore();
  const confirmAction = useConfirmStore((state) => state.confirm);

  React.useEffect(() => {
    initializeHsns();
  }, [initializeHsns]);

  // Form modals state
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingHsnId, setEditingHsnId] = React.useState<string | null>(null);
  
  // Input fields
  const [code, setCode] = React.useState("");
  const [gstRate, setGstRate] = React.useState(18);
  const [description, setDescription] = React.useState("");
  const [isActive, setIsActive] = React.useState(true);
  
  const [searchTerm, setSearchTerm] = React.useState("");

  const handleOpenAdd = () => {
    setEditingHsnId(null);
    setCode("");
    setGstRate(18);
    setDescription("");
    setIsActive(true);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (hsn: any) => {
    setEditingHsnId(hsn._id);
    setCode(hsn.code);
    setGstRate(hsn.gstRate);
    setDescription(hsn.description);
    setIsActive(hsn.isActive);
    setIsModalOpen(true);
  };

  const handleSaveHsn = (e: React.FormEvent) => {
    e.preventDefault();

    if (!code || isNaN(Number(code))) {
      addToast("Please provide a valid numeric HSN Code.", "error");
      return;
    }

    const data = {
      code,
      gstRate: Number(gstRate),
      description,
      isActive
    };

    const performSave = async () => {
      try {
        if (editingHsnId) {
          await updateHsn(editingHsnId, data);
          addToast("HSN record updated successfully.", "success");
        } else {
          // Check for duplicates
          if (hsns.some(h => h.code === code)) {
            addToast(`HSN Code ${code} already exists in the system.`, "error");
            return;
          }
          await addHsn(data);
          addToast("New HSN tax slab added to B2B registry.", "success");
        }
        setIsModalOpen(false);
      } catch (err: unknown) {
        addToast((err as any)?.message || "Failed to save HSN record", "error");
      }
    };

    if (editingHsnId) {
      confirmAction({
        title: "Confirm Update",
        message: `Are you sure you want to save changes to the HSN record "${code}"?`,
        confirmText: "Save Changes",
        cancelText: "Cancel",
        type: "warning",
        onConfirm: performSave
      });
    } else {
      performSave();
    }
  };

  const handleDelete = (id: string) => {
    const record = hsns.find(h => h._id === id);
    confirmAction({
      title: "Delete HSN Record",
      message: `Are you sure you want to permanently delete the HSN code "${record?.code || 'this record'}" from the database? This action is permanent and cannot be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      type: "danger",
      onConfirm: async () => {
        try {
          await deleteHsn(id);
          addToast("HSN code removed.", "success");
        } catch (err: unknown) {
          addToast((err as any)?.message || "Failed to delete HSN code", "error");
        }
      }
    });
  };

  const filteredHsns = React.useMemo(() => {
    if (!searchTerm) return hsns;
    const term = searchTerm.toLowerCase();
    return hsns.filter(h => 
      h.code.includes(term) || 
      h.description.toLowerCase().includes(term)
    );
  }, [hsns, searchTerm]);

  return (
    <div className="space-y-6 text-foreground">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">HSN & Tax Slabs</h1>
          <p className="text-muted-foreground mt-1">Manage B2B HSN codes and Indian Standard GST rates (CGST, SGST, IGST).</p>
        </div>
        <Button onClick={handleOpenAdd}>
          <Plus className="h-4 w-4 mr-2" /> Add HSN Code
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: Supplier State Location Selector */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-lg">Warehouse Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Configure the seller's primary state location. Place of supply tax calculations will evaluate destination states relative to this.
            </p>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase">Default Dispatch State:</label>
              <select
                className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm font-semibold text-foreground focus:ring-2 focus:ring-primary"
                value={supplierState}
                onChange={(e) => {
                  setSupplierState(e.target.value);
                  addToast(`Supplier warehouse state updated to ${e.target.value}`, "info");
                }}
              >
                {INDIAN_STATES.map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>
            <div className="p-3 bg-secondary/30 border rounded-lg text-xs space-y-1.5">
              <div className="font-semibold">Indian Standard POS Rules:</div>
              <div>• Destination is <strong>{supplierState}</strong>: Intrastate taxes apply (CGST + SGST).</div>
              <div>• Destination is <strong>Other State</strong>: Interstate taxes apply (IGST).</div>
            </div>
          </CardContent>
        </Card>

        {/* Right Side: HSN Slabs Table */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="p-4 border-b flex flex-row items-center justify-between gap-4">
              <div className="relative max-w-xs w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search HSN code..."
                  className="pl-9 text-foreground"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-muted-foreground uppercase bg-secondary/50">
                    <tr>
                      <th className="px-6 py-4">HSN Code</th>
                      <th className="px-6 py-4">GST Rate</th>
                      <th className="px-6 py-4">Tax Breakdown (POS)</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredHsns.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                          No HSN registry found. Add one to associate with B2B cargo.
                        </td>
                      </tr>
                    ) : (
                      filteredHsns.map((hsn) => (
                        <tr key={hsn._id} className="hover:bg-secondary/20 transition-colors">
                          <td className="px-6 py-4 font-bold">
                            <div>HSN {hsn.code}</div>
                            <span className="text-[10px] text-muted-foreground font-normal line-clamp-1 block max-w-xs">
                              {hsn.description}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-bold text-primary">
                            {hsn.gstRate}%
                          </td>
                          <td className="px-6 py-4 font-mono text-[10px] text-muted-foreground whitespace-nowrap">
                            <div>Intrastate: {hsn.gstRate / 2}% CGST + {hsn.gstRate / 2}% SGST</div>
                            <div>Interstate: {hsn.gstRate}% IGST</div>
                          </td>
                          <td className="px-6 py-4">
                            {hsn.isActive ? (
                              <span className="bg-success/10 text-success px-2 py-0.5 rounded-full text-xs font-semibold inline-flex items-center gap-1">
                                <CheckCircle className="h-3 w-3" /> Active
                              </span>
                            ) : (
                              <span className="bg-muted text-muted-foreground px-2 py-0.5 rounded-full text-xs font-semibold inline-flex items-center gap-1">
                                <XCircle className="h-3 w-3" /> Inactive
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right space-x-1 whitespace-nowrap">
                            <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(hsn)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => handleDelete(hsn._id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add / Edit Modal Popup */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="max-w-md w-full border-border">
            <CardHeader>
              <CardTitle>{editingHsnId ? "Edit HSN Code" : "Add HSN Code"}</CardTitle>
            </CardHeader>
            <form onSubmit={handleSaveHsn}>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold">HSN Code (Numeric String)</label>
                  <Input
                    required
                    placeholder="e.g. 3924"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    disabled={!!editingHsnId}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold">Integrated GST Rate (%)</label>
                  <select
                    className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm font-semibold text-foreground focus:ring-2 focus:ring-primary"
                    value={gstRate}
                    onChange={(e) => setGstRate(Number(e.target.value))}
                  >
                    <option value={5}>5% (2.5% CGST + 2.5% SGST)</option>
                    <option value={12}>12% (6% CGST + 6% SGST)</option>
                    <option value={18}>18% (9% CGST + 9% SGST)</option>
                    <option value={28}>28% (14% CGST + 14% SGST)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold">Description / Commodity Classification</label>
                  <textarea
                    rows={3}
                    placeholder="Commodity description..."
                    className="w-full p-3 rounded-lg border border-border bg-background text-sm text-foreground focus:ring-2 focus:ring-primary"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="isActiveHsn"
                    className="rounded text-primary focus:ring-primary bg-background border-border"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                  />
                  <label htmlFor="isActiveHsn" className="text-sm font-medium text-foreground">
                    Active for Product mapping
                  </label>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    Save Record
                  </Button>
                </div>
              </CardContent>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
