"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Search, Eye, Edit2, Trash2, Plus } from "lucide-react";
import { apiClient } from "@/lib/apiClient";
import { useToastStore } from "@/stores/toastStore";
import { useConfirmStore } from "@/stores/confirmStore";
import { Pagination } from "@/components/ui/Pagination";
import { Avatar } from "@/components/ui/Avatar";
import { useDraggableScroll } from "@/hooks/useDraggableScroll";
import { CustomerFormModal } from "@/components/shared/CustomerFormModal";
import { customerService } from "@/services/customerService";
import { Customer } from "@/types";
import { usePermissions } from "@/hooks/usePermissions";

interface CustomerListProps {
  title: string;
  description: string;
  customerTypeFilter: string;
}

export function CustomerList({ title, description, customerTypeFilter }: CustomerListProps) {
  const [customers, setCustomers] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState("");
  const { addToast } = useToastStore();
  const confirmAction = useConfirmStore((s) => s.confirm);

  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingCustomer, setEditingCustomer] = React.useState<Customer | null>(null);

  const [currentPage, setCurrentPage] = React.useState(1);
  const [itemsPerPage, setItemsPerPage] = React.useState(10);
  const [totalItems, setTotalItems] = React.useState(0);
  const { ref, onMouseDown, onMouseLeave, onMouseUp, onMouseMove, onDragStart } = useDraggableScroll<HTMLDivElement>();

  const { hasPermission } = usePermissions();
  let moduleName = "customers_b2c";
  if (customerTypeFilter === "B2B") moduleName = "customers_b2b";
  else if (customerTypeFilter === "Dropshipping") moduleName = "customers_dropshipping";

  const fetchCustomers = React.useCallback(async () => {
    try {
      setIsLoading(true);
      let endpoint = `/customers?page=${currentPage}&limit=${itemsPerPage}`;
      if (customerTypeFilter) endpoint += `&customerType=${customerTypeFilter}`;
      if (searchTerm) endpoint += `&search=${encodeURIComponent(searchTerm)}`;
      
      const data = await apiClient.get<any>(endpoint);
      setCustomers(data.customers || []);
      setTotalItems(data.total || 0);
    } catch (err: any) {
      addToast(err.message || "Failed to load customers", "error");
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, itemsPerPage, customerTypeFilter, searchTerm, addToast]);

  React.useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchCustomers();
  };

  const handleOpenAddModal = () => {
    setEditingCustomer(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (cust: Customer) => {
    setEditingCustomer(cust);
    setIsModalOpen(true);
  };

  const handleDeleteCustomer = (id: string) => {
    confirmAction({
      title: "Delete Customer?",
      message: "Are you sure you want to delete this customer? This action cannot be undone.",
      confirmText: "Delete",
      type: "danger",
      onConfirm: async () => {
        try {
          await customerService.deleteCustomer(id);
          addToast("Customer deleted successfully", "success");
          fetchCustomers();
        } catch (err: unknown) {
          addToast((err as any).message || "Failed to delete customer", "error");
        }
      }
    });
  };

  const totalPages = Math.ceil(totalItems / itemsPerPage);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{title}</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">{description}</p>
        </div>
        {hasPermission(moduleName, "create") && (
          <Button onClick={handleOpenAddModal} className="shrink-0 gap-2 font-bold h-9 shadow-sm shadow-primary/20">
            <Plus className="h-4 w-4" />
            Create Customer
          </Button>
        )}
      </div>

      <Card className="border border-border">
        <CardHeader className="border-b pb-4 bg-card rounded-t-xl">
          <form onSubmit={handleSearch} className="flex gap-2 w-full max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, company..."
                className="pl-9 h-9 text-xs"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button type="submit" size="sm" variant="secondary" className="h-9">Search</Button>
          </form>
        </CardHeader>
        <CardContent className="p-0">
          <div 
            className="overflow-x-auto min-h-[400px] cursor-grab active:cursor-grabbing select-none"
            ref={ref}
            onMouseDown={onMouseDown}
            onMouseLeave={onMouseLeave}
            onMouseUp={onMouseUp}
            onMouseMove={onMouseMove}
          >
            <table className="w-full text-sm text-left whitespace-nowrap" onDragStart={onDragStart}>
              <thead className="text-xs text-muted-foreground uppercase bg-secondary border-b border-border">
                <tr>
                  <th className="px-6 py-3.5">Customer</th>
                  <th className="px-6 py-3.5">Company/GSTIN</th>
                  <th className="px-6 py-3.5">Joined</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-xs">
                {isLoading ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-10 text-center text-muted-foreground">Loading customers...</td>
                  </tr>
                ) : customers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-10 text-center text-muted-foreground">No customers found.</td>
                  </tr>
                ) : (
                  customers.map((cust) => (
                    <tr key={cust._id} className="hover:bg-secondary/15 transition-colors">
                      <td className="px-6 py-4 flex items-center gap-3">
                        <Avatar initials={cust.initials || "C"} className="bg-primary text-primary-foreground border shrink-0" />
                        <div className="min-w-0">
                          <p className="font-bold text-foreground truncate">{cust.name}</p>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{cust.email}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-semibold text-foreground">{cust.company || "Individual"}</p>
                        {cust.gstin && <p className="text-[10px] font-mono text-primary font-bold mt-0.5">GSTIN: {cust.gstin}</p>}
                      </td>
                      <td className="px-6 py-4">{new Date(cust.createdAt).toLocaleDateString()}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link href={`/manager/customers/${cust._id}`}>
                            <Button variant="outline" size="sm" className="font-semibold h-8 w-8 p-0" title="View Profile">
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </Link>
                          {hasPermission(moduleName, "update") && (
                            <Button variant="outline" size="sm" className="font-semibold h-8 w-8 p-0" title="Edit Customer" onClick={() => handleOpenEditModal(cust)}>
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {hasPermission(moduleName, "delete") && (
                            <Button variant="outline" size="sm" className="font-semibold h-8 w-8 p-0 text-destructive hover:bg-destructive/5 hover:text-destructive" title="Delete Customer" onClick={() => handleDeleteCustomer(cust._id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="px-3 pb-1 pt-0 border-t">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              totalItems={totalItems}
              itemsPerPage={itemsPerPage}
              onItemsPerPageChange={setItemsPerPage}
            />
          </div>
        </CardContent>
      </Card>
      <CustomerFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          setIsModalOpen(false);
          fetchCustomers();
        }}
        editingCustomer={editingCustomer}
      />
    </div>
  );
}
