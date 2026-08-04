"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { useDraggableScroll } from "@/hooks/useDraggableScroll";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Avatar } from "@/components/ui/Avatar";
import { useToastStore } from "@/stores/toastStore";
import { useConfirmStore } from "@/stores/confirmStore";
import { Plus, Edit2, Trash2, Shield, Search, Link as LinkIcon } from "lucide-react";
import { apiClient } from "@/lib/apiClient";

export interface Manager {
  _id: string;
  name: string;
  email: string;
  assignedRole?: string;
  permissions: string[];
  status: "active" | "suspended";
  lastLogin?: string;
  lastLogout?: string;
  createdAt: string;
}

const PERMISSION_GROUPS = [
  {
    group: "Catalog Management",
    permissions: [
      { id: "catalog_products", label: "Products" },
      { id: "catalog_categories", label: "Categories" },
      { id: "catalog_collections", label: "Collections" },
    ]
  },
  {
    group: "Orders",
    permissions: [
      { id: "orders_b2c", label: "B2C Orders" },
      { id: "orders_b2b", label: "B2B Orders" },
      { id: "orders_dropshipping", label: "Dropshipping Orders" },
    ]
  },
  {
    group: "Customers",
    permissions: [
      { id: "customers_b2c", label: "B2C Customers" },
      { id: "customers_b2b", label: "B2B Customers" },
      { id: "customers_dropshipping", label: "Dropshipping Customers" },
    ]
  },
  {
    group: "Documents (Invoices)",
    permissions: [
      { id: "invoices_invoice", label: "Invoice Lists" },
      { id: "invoices_quote", label: "Quotes" },
      { id: "invoices_receipt", label: "Receipts" },
    ]
  },
  {
    group: "Inquiries",
    permissions: [
      { id: "inquiries_wholesale", label: "Wholesale" },
      { id: "inquiries_dropshipping", label: "Dropshipping" },
      { id: "inquiries_support", label: "Support" },
      { id: "inquiries_franchise", label: "Franchise" },
      { id: "inquiries_general", label: "General" },
    ]
  },
  {
    group: "Operations & Config",
    permissions: [
      { id: "ops_upgrades", label: "Upgrade Requests" },
      { id: "ops_hsn", label: "HSN Management" },
      { id: "ops_shipping", label: "Shipping Options" },
      { id: "ops_coupons", label: "Coupons" },
    ]
  },
  {
    group: "Content & Feedback",
    permissions: [
      { id: "content_reviews", label: "Reviews" },
      { id: "content_cms", label: "Website CMS" },
    ]
  },
  {
    group: "System",
    permissions: [
      { id: "system_settings", label: "Settings" },
    ]
  }
];

export default function AdminManagersPage() {
  const { addToast } = useToastStore();
  const { ref, onMouseDown, onMouseLeave, onMouseUp, onMouseMove, onDragStart } = useDraggableScroll<HTMLDivElement>();
  const confirmAction = useConfirmStore((state) => state.confirm);
  const [managers, setManagers] = React.useState<Manager[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState("");

  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [isFormSubmitting, setIsFormSubmitting] = React.useState(false);
  const [editingManager, setEditingManager] = React.useState<Manager | null>(null);

  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [assignedRole, setAssignedRole] = React.useState("Staff Manager");
  const [status, setStatus] = React.useState<"active" | "suspended">("active");
  const [selectedPermissions, setSelectedPermissions] = React.useState<string[]>([]);

  const fetchManagers = async () => {
    try {
      setIsLoading(true);
      const data = await apiClient.get<Manager[]>("/admin/managers");
      setManagers(Array.isArray(data) ? data : []);
    } catch (err: any) {
      addToast(err.message || "Failed to load managers", "error");
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    fetchManagers();
  }, []);

  const resetForm = () => {
    setEditingManager(null);
    setName("");
    setEmail("");
    setPassword("");
    setAssignedRole("Staff Manager");
    setStatus("active");
    setSelectedPermissions([]);
  };

  const handleOpenAddModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (mgr: Manager) => {
    setEditingManager(mgr);
    setName(mgr.name);
    setEmail(mgr.email);
    setPassword("");
    setAssignedRole(mgr.assignedRole || "Staff Manager");
    setStatus(mgr.status || "active");
    setSelectedPermissions(mgr.permissions || []);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) {
      addToast("Please fill in required fields", "warning");
      return;
    }

    if (!editingManager && !password) {
      addToast("Password is required for new managers", "warning");
      return;
    }

    setIsFormSubmitting(true);
    try {
      const payload = {
        name,
        email: email.toLowerCase().trim(),
        password: password || undefined,
        assignedRole,
        status,
        permissions: selectedPermissions
      };

      if (editingManager) {
        await apiClient.put(`/admin/managers`, { _id: editingManager._id, ...payload });
      } else {
        await apiClient.post(`/admin/managers`, payload);
      }

      addToast(editingManager ? "Manager updated successfully!" : "Manager created successfully!", "success");
      setIsModalOpen(false);
      resetForm();
      fetchManagers();
    } catch (err: any) {
      addToast(err.message || "Failed to save manager", "error");
    } finally {
      setIsFormSubmitting(false);
    }
  };

  const handleDeleteManager = (id: string) => {
    confirmAction({
      title: "Delete Manager Account",
      message: "Are you sure you want to delete this manager account? This action cannot be undone.",
      confirmText: "Delete Account",
      type: "danger",
      onConfirm: async () => {
        try {
          await apiClient.delete(`/admin/managers?id=${id}`);
          addToast("Manager deleted successfully", "success");
          fetchManagers();
        } catch (err: any) {
          addToast(err.message || "Failed to delete manager", "error");
        }
      },
    });
  };

  const togglePermission = (permId: string, action?: "create" | "read" | "update" | "delete") => {
    const permString = action ? `${permId}:${action}` : permId;
    setSelectedPermissions(prev => {
      // If turning off a specific CRUD, but they have the root perm, we must expand the root perm into the other 3 CRUDs and remove the root perm.
      if (prev.includes(permString)) {
        return prev.filter(p => p !== permString);
      } else if (action && prev.includes(permId)) {
        // They have the root perm, and we are unchecking ONE action. We need to convert the root perm to the remaining 3 actions.
        const allActions = ["create", "read", "update", "delete"];
        const remainingActions = allActions.filter(a => a !== action).map(a => `${permId}:${a}`);
        return [...prev.filter(p => p !== permId), ...remainingActions];
      } else {
        return [...prev, permString];
      }
    });
  };

  const toggleAllModuleCrud = (permId: string, checked: boolean) => {
    setSelectedPermissions(prev => {
      const allActions = ["create", "read", "update", "delete"].map(a => `${permId}:${a}`);
      const filtered = prev.filter(p => p !== permId && !p.startsWith(`${permId}:`));
      if (checked) {
        return [...filtered, permId]; // Use root perm for all
      } else {
        return filtered;
      }
    });
  };

  const hasPermission = (permId: string, action: "create" | "read" | "update" | "delete") => {
    return selectedPermissions.includes(permId) || selectedPermissions.includes(`${permId}:${action}`);
  };

  const hasAllCrud = (permId: string) => {
    return selectedPermissions.includes(permId) || 
      (["create", "read", "update", "delete"].every(action => selectedPermissions.includes(`${permId}:${action}`)));
  };

  const filteredManagers = React.useMemo(() => {
    if (!searchTerm) return managers;
    const term = searchTerm.toLowerCase();
    return managers.filter(m =>
      m.name.toLowerCase().includes(term) || m.email.toLowerCase().includes(term)
    );
  }, [managers, searchTerm]);

  return (
    <div className="space-y-6 text-foreground container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Staff & Managers</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">Manage staff accounts and granular RBAC permissions.</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            onClick={() => {
              navigator.clipboard.writeText(window.location.origin + "/manager/login");
              addToast("Manager login URL copied to clipboard!", "success");
            }}
            className="w-full sm:w-auto font-bold flex items-center justify-center gap-1.5 shadow-sm"
          >
            <LinkIcon className="h-4 w-4" /> Share Login URL
          </Button>
          <Button onClick={handleOpenAddModal} className="w-full sm:w-auto font-bold flex items-center justify-center gap-1.5 shadow">
            <Plus className="h-4.5 w-4.5" /> Create Manager
          </Button>
        </div>
      </div>

      <Card className="border border-border">
        <CardHeader className="border-b pb-4 flex flex-col gap-4 bg-card rounded-t-xl">
          <div>
            <CardTitle className="text-lg font-bold">Manager Accounts</CardTitle>
            <CardDescription>Accounts that have access to the dedicated /manager portal.</CardDescription>
          </div>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              className="pl-9 text-xs h-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0 flex-col">
          <div
            className="overflow-x-auto overflow-y-auto min-h-[400px] cursor-grab active:cursor-grabbing select-none"
            ref={ref}
            onMouseDown={onMouseDown}
            onMouseLeave={onMouseLeave}
            onMouseUp={onMouseUp}
            onMouseMove={onMouseMove}
          >
            <table className="w-full text-sm text-left whitespace-nowrap" onDragStart={onDragStart}>
              <thead className="text-xs text-muted-foreground uppercase bg-secondary border-b border-border">
                <tr>
                  <th className="px-6 py-3.5">Manager Info</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">Permissions</th>
                  <th className="px-6 py-3.5 text-center">Last Login</th>
                  <th className="px-6 py-3.5 text-center">Last Logout</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-muted-foreground">Loading managers...</td>
                  </tr>
                ) : filteredManagers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-muted-foreground">No managers found.</td>
                  </tr>
                ) : (
                  filteredManagers.map((mgr) => (
                    <tr key={mgr._id} className="hover:bg-secondary/15 transition-colors">
                      <td className="px-6 py-4 flex items-center gap-3">
                        <Avatar initials={mgr.name.substring(0, 2).toUpperCase()} className="bg-primary text-primary-foreground border shrink-0" />
                        <div className="min-w-0">
                          <p className="font-bold text-foreground truncate">{mgr.name}</p>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{mgr.email}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${mgr.status === "active" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                          }`}>
                          {mgr.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-xs text-muted-foreground font-semibold flex items-center gap-1.5">
                          <Shield className="h-3.5 w-3.5 text-primary" />
                          {mgr.permissions?.length || 0} Permissions Granted
                        </p>
                      </td>
                      <td className="px-6 py-4 text-center text-xs text-muted-foreground">
                        {mgr.lastLogin ? new Date(mgr.lastLogin).toLocaleString() : "Never"}
                      </td>
                      <td className="px-6 py-4 text-center text-xs text-muted-foreground">
                        {mgr.lastLogout ? new Date(mgr.lastLogout).toLocaleString() : "Never"}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button variant="outline" size="sm" className="font-semibold h-8 w-8 p-0" title="Edit Manager" onClick={() => handleOpenEditModal(mgr)}>
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="outline" size="sm" className="font-semibold h-8 w-8 p-0 text-destructive hover:bg-destructive/5 hover:text-destructive" title="Delete Manager" onClick={() => handleDeleteManager(mgr._id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card border rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 text-foreground space-y-6">
            <div>
              <h3 className="text-xl font-bold tracking-tight">{editingManager ? "Edit Manager Account" : "Create Manager Account"}</h3>
              <p className="text-muted-foreground text-xs mt-0.5">Configure access credentials and granular permissions.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-bold text-muted-foreground">Name *</label>
                  <Input placeholder="Manager Name" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <label className="font-bold text-muted-foreground">Email *</label>
                  <Input placeholder="Manager Email" value={email} onChange={(e) => setEmail(e.target.value)} required type="email" />
                </div>
                <div className="space-y-1.5">
                  <label className="font-bold text-muted-foreground">Password {editingManager && "(Leave empty to keep)"} *</label>
                  <Input placeholder="Account Password" value={password} onChange={(e) => setPassword(e.target.value)} required={!editingManager} type="password" />
                </div>
                <div className="space-y-1.5">
                  <label className="font-bold text-muted-foreground">Assigned Role</label>
                  <Input placeholder="e.g. Staff Manager" value={assignedRole} onChange={(e) => setAssignedRole(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <label className="font-bold text-muted-foreground">Account Status</label>
                  <select value={status} onChange={(e) => setStatus(e.target.value as any)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>

              </div>

              <div className="border-t pt-4 space-y-4">
                <h4 className="text-sm font-bold flex items-center gap-2"><Shield className="h-4 w-4 text-primary" /> Permissions Matrix</h4>
                <div className="overflow-x-auto border rounded bg-secondary/5">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-secondary/10 text-xs uppercase font-bold text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3">Module</th>
                        <th className="px-4 py-3 text-center">Create</th>
                        <th className="px-4 py-3 text-center">Read</th>
                        <th className="px-4 py-3 text-center">Update</th>
                        <th className="px-4 py-3 text-center">Delete</th>
                        <th className="px-4 py-3 text-center">All</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {PERMISSION_GROUPS.map(group => (
                        <React.Fragment key={group.group}>
                          <tr className="bg-secondary/20">
                            <td colSpan={6} className="px-4 py-2 font-bold text-[10px] uppercase tracking-wider text-muted-foreground">{group.group}</td>
                          </tr>
                          {group.permissions.map(perm => (
                            <tr key={perm.id} className="hover:bg-secondary/10 transition-colors">
                              <td className="px-4 py-3 font-semibold text-xs">{perm.label}</td>
                              {(["create", "read", "update", "delete"] as const).map(action => (
                                <td key={action} className="px-4 py-3 text-center">
                                  <input
                                    type="checkbox"
                                    title={`${action} ${perm.label}`}
                                    className="rounded text-primary focus:ring-primary border-border bg-background cursor-pointer"
                                    checked={hasPermission(perm.id, action)}
                                    onChange={() => togglePermission(perm.id, action)}
                                  />
                                </td>
                              ))}
                              <td className="px-4 py-3 text-center border-l border-border/50">
                                <input
                                  type="checkbox"
                                  title={`All CRUD for ${perm.label}`}
                                  className="rounded text-primary focus:ring-primary border-border bg-background cursor-pointer"
                                  checked={hasAllCrud(perm.id)}
                                  onChange={(e) => toggleAllModuleCrud(perm.id, e.target.checked)}
                                />
                              </td>
                            </tr>
                          ))}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} disabled={isFormSubmitting} className="font-bold">
                  Cancel
                </Button>
                <Button type="submit" disabled={isFormSubmitting} className="font-bold shadow">
                  {isFormSubmitting ? "Saving..." : "Save Manager"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
