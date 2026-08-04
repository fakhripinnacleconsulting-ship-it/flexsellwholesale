"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToastStore } from "@/stores/toastStore";
import { apiClient } from "@/lib/apiClient";
import { useAuthStore } from "@/stores/authStore";
import {
  ShieldCheck,
  UserPlus,
  Search,
  Edit,
  Trash2,
  Lock,
  Mail,
  Phone,
  Building,
  Eye,
  EyeOff,
  User,
  KeyRound,
  X,
  AlertCircle
} from "lucide-react";

export interface AdminAccount {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  createdAt?: string;
  updatedAt?: string;
}

export function AdminManagementTab() {
  const { addToast } = useToastStore();
  const currentCustomer = useAuthStore((state: any) => state.customer);

  const [admins, setAdmins] = React.useState<AdminAccount[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState("");

  // Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = React.useState(false);

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [selectedAdmin, setSelectedAdmin] = React.useState<AdminAccount | null>(null);

  // Form Fields
  const [formName, setFormName] = React.useState("");
  const [formEmail, setFormEmail] = React.useState("");
  const [formPassword, setFormPassword] = React.useState("");
  const [formPhone, setFormPhone] = React.useState("");
  const [formCompany, setFormCompany] = React.useState("Executive Management");
  const [showPassword, setShowPassword] = React.useState(false);

  const fetchAdmins = React.useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await apiClient.get<AdminAccount[]>("/admin/admins");
      setAdmins(data || []);
    } catch (err: any) {
      addToast(err.message || "Failed to load admin accounts", "error");
    } finally {
      setIsLoading(false);
    }
  }, [addToast]);

  React.useEffect(() => {
    fetchAdmins();
  }, [fetchAdmins]);

  const handleOpenCreateModal = () => {
    setFormName("");
    setFormEmail("");
    setFormPassword("");
    setFormPhone("");
    setFormCompany("Executive Management");
    setShowPassword(false);
    setIsCreateModalOpen(true);
  };

  const handleOpenEditModal = (admin: AdminAccount) => {
    setSelectedAdmin(admin);
    setFormName(admin.name);
    setFormEmail(admin.email);
    setFormPassword(""); // Leave empty unless changing
    setFormPhone(admin.phone || "");
    setFormCompany(admin.company || "Executive Management");
    setShowPassword(false);
    setIsEditModalOpen(true);
  };

  const handleOpenDeleteModal = (admin: AdminAccount) => {
    setSelectedAdmin(admin);
    setIsDeleteModalOpen(true);
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formEmail || !formPassword) {
      addToast("Name, Email, and Password are required.", "warning");
      return;
    }

    setIsSubmitting(true);
    try {
      await apiClient.post("/admin/admins", {
        name: formName,
        email: formEmail,
        password: formPassword,
        phone: formPhone,
        company: formCompany,
      });

      addToast(`Admin account for ${formName} created! Credentials sent to email.`, "success");
      setIsCreateModalOpen(false);
      fetchAdmins();
    } catch (err: any) {
      addToast(err.message || "Failed to create admin account", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdmin) return;

    setIsSubmitting(true);
    try {
      await apiClient.put("/admin/admins", {
        _id: selectedAdmin._id,
        name: formName,
        email: formEmail,
        password: formPassword || undefined,
        phone: formPhone,
        company: formCompany,
      });

      addToast("Admin account details updated successfully!", "success");
      setIsEditModalOpen(false);
      setSelectedAdmin(null);
      fetchAdmins();
    } catch (err: any) {
      addToast(err.message || "Failed to update admin account", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAdmin = async () => {
    if (!selectedAdmin) return;

    setIsSubmitting(true);
    try {
      await apiClient.delete(`/admin/admins?id=${selectedAdmin._id}`);
      addToast("Admin account deleted successfully.", "success");
      setIsDeleteModalOpen(false);
      setSelectedAdmin(null);
      fetchAdmins();
    } catch (err: any) {
      addToast(err.message || "Failed to delete admin account", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredAdmins = React.useMemo(() => {
    if (!searchTerm.trim()) return admins;
    const query = searchTerm.toLowerCase().trim();
    return admins.filter(
      (a) =>
        a.name.toLowerCase().includes(query) ||
        a.email.toLowerCase().includes(query) ||
        (a.company && a.company.toLowerCase().includes(query)) ||
        (a.phone && a.phone.includes(query))
    );
  }, [admins, searchTerm]);

  return (
    <div className="space-y-6">
      <Card className="border border-border shadow-sm">
        <CardHeader className="border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-xl">Admin Account Management</CardTitle>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20">
                {admins.length} Active Admins
              </span>
            </div>
            <CardDescription className="text-xs mt-1">
              Create, update, and manage full Super Admin accounts with complete system privileges.
            </CardDescription>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search admin by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>
            <Button
              onClick={handleOpenCreateModal}
              className="font-bold cursor-pointer shrink-0 flex items-center gap-1.5"
            >
              <UserPlus className="h-4 w-4" /> Add Admin
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Loading admin accounts...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
                <thead>
                  <tr className="bg-secondary/40 border-b border-border text-muted-foreground font-semibold text-[11px] uppercase tracking-wider">
                    <th className="py-3.5 px-5">Admin Profile</th>
                    <th className="py-3.5 px-4">Email Address</th>
                    <th className="py-3.5 px-4">Contact Phone</th>
                    <th className="py-3.5 px-4">Department / Title</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredAdmins.map((admin) => {
                    const isSelf = currentCustomer?._id === admin._id;

                    return (
                      <tr key={admin._id} className="hover:bg-secondary/20 transition-colors">
                        {/* Profile */}
                        <td className="py-3.5 px-5 align-middle">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center border border-primary/20 shrink-0">
                              {admin.name
                                .split(" ")
                                .map((w) => w[0])
                                .join("")
                                .toUpperCase()
                                .slice(0, 2)}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-foreground text-sm">{admin.name}</span>
                                {isSelf && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                                    You (Active)
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-muted-foreground font-mono">ID: {admin._id}</span>
                            </div>
                          </div>
                        </td>

                        {/* Email */}
                        <td className="py-3.5 px-4 align-middle font-mono font-medium text-foreground">
                          {admin.email}
                        </td>

                        {/* Phone */}
                        <td className="py-3.5 px-4 align-middle text-muted-foreground">
                          {admin.phone || "N/A"}
                        </td>

                        {/* Company / Department */}
                        <td className="py-3.5 px-4 align-middle font-medium">
                          {admin.company || "Executive Management"}
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4 align-middle">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                            <ShieldCheck className="h-3 w-3" /> Full Super Admin
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-5 align-middle text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Edit Admin / Change Password"
                              onClick={() => handleOpenEditModal(admin)}
                              className="h-8 w-8 p-0 cursor-pointer text-muted-foreground hover:text-foreground hover:bg-secondary"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              title={isSelf ? "You cannot delete your own account" : "Delete Admin Account"}
                              disabled={isSelf}
                              onClick={() => handleOpenDeleteModal(admin)}
                              className="h-8 w-8 p-0 cursor-pointer text-destructive hover:text-destructive hover:bg-destructive/10 disabled:opacity-30"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredAdmins.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-muted-foreground text-sm">
                        No admin accounts found matching your search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* CREATE ADMIN MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-background border border-border rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-4 border-b border-border bg-secondary/30">
              <div className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-primary" />
                <h3 className="font-bold text-base">Add New Admin Account</h3>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsCreateModalOpen(false)}
                className="h-8 w-8 rounded-full"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form onSubmit={handleCreateAdmin} className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 p-3 rounded-lg text-xs flex items-start gap-2">
                <Mail className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  <strong>Automated Email Dispatch:</strong> Upon account creation, login credentials (Email, Password, Login URL) will be automatically sent to the new admin&apos;s email address.
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                  <User className="h-3.5 w-3.5" /> Full Name *
                </label>
                <Input
                  required
                  placeholder="e.g. Rajesh Sharma"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="text-sm font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5" /> Email Address *
                </label>
                <Input
                  required
                  type="email"
                  placeholder="e.g. rajesh@flexsellwholesale.com"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="text-sm font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                  <Lock className="h-3.5 w-3.5" /> Set Initial Password *
                </label>
                <div className="relative">
                  <Input
                    required
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter secure initial password"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    className="text-sm font-mono pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5" /> Phone Number
                  </label>
                  <Input
                    placeholder="e.g. +91 98765 43210"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                    <Building className="h-3.5 w-3.5" /> Title / Department
                  </label>
                  <Input
                    placeholder="e.g. Co-Founder & Director"
                    value={formCompany}
                    onChange={(e) => setFormCompany(e.target.value)}
                    className="text-sm"
                  />
                </div>
              </div>

              <div className="pt-4 border-t flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="cursor-pointer font-bold"
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting} className="font-bold cursor-pointer">
                  {isSubmitting ? "Creating & Emailing..." : "Create Admin Account"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT ADMIN MODAL */}
      {isEditModalOpen && selectedAdmin && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-background border border-border rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-4 border-b border-border bg-secondary/30">
              <div className="flex items-center gap-2">
                <Edit className="h-5 w-5 text-primary" />
                <h3 className="font-bold text-base">Edit Admin: {selectedAdmin.name}</h3>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setIsEditModalOpen(false);
                  setSelectedAdmin(null);
                }}
                className="h-8 w-8 rounded-full"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form onSubmit={handleUpdateAdmin} className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                  <User className="h-3.5 w-3.5" /> Full Name *
                </label>
                <Input
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="text-sm font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5" /> Email Address *
                </label>
                <Input
                  required
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="text-sm font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                  <KeyRound className="h-3.5 w-3.5" /> Change Password (Leave blank to keep existing)
                </label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter new password if changing"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    className="text-sm font-mono pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5" /> Phone Number
                  </label>
                  <Input
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                    <Building className="h-3.5 w-3.5" /> Title / Department
                  </label>
                  <Input
                    value={formCompany}
                    onChange={(e) => setFormCompany(e.target.value)}
                    className="text-sm"
                  />
                </div>
              </div>

              <div className="pt-4 border-t flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setSelectedAdmin(null);
                  }}
                  className="cursor-pointer font-bold"
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting} className="font-bold cursor-pointer">
                  {isSubmitting ? "Updating..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {isDeleteModalOpen && selectedAdmin && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-background border border-border rounded-xl shadow-xl w-full max-w-md p-6 space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto border border-destructive/20">
              <AlertCircle className="h-6 w-6" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-foreground">Delete Admin Account?</h3>
              <p className="text-xs text-muted-foreground">
                Are you sure you want to remove <strong>{selectedAdmin.name}</strong> ({selectedAdmin.email}) from Super Admins? This action cannot be undone.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setSelectedAdmin(null);
                }}
                className="cursor-pointer font-bold"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={isSubmitting}
                onClick={handleDeleteAdmin}
                className="font-bold cursor-pointer"
              >
                {isSubmitting ? "Deleting..." : "Confirm Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
