"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Search, Eye } from "lucide-react";
import { apiClient } from "@/lib/apiClient";
import { useToastStore } from "@/stores/toastStore";
import { useDraggableScroll } from "@/hooks/useDraggableScroll";
import { InquiryDetailsModal } from "@/components/managers/InquiryDetailsModal";

interface InquiryListProps {
  title: string;
  description: string;
  category: string;
}

export function InquiryList({ title, description, category }: InquiryListProps) {
  const [inquiries, setInquiries] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState("");
  const { addToast } = useToastStore();
  const { ref, onMouseDown, onMouseLeave, onMouseUp, onMouseMove, onDragStart } = useDraggableScroll<HTMLDivElement>();

  const [selectedInquiry, setSelectedInquiry] = React.useState<any>(null);
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  const fetchInquiries = React.useCallback(async () => {
    try {
      setIsLoading(true);
      let endpoint = `/inquiries?category=${category}`;
      if (searchTerm) endpoint += `&search=${encodeURIComponent(searchTerm)}`;
      
      const data = await apiClient.get<any[]>(endpoint);
      setInquiries(data || []);
    } catch (err: any) {
      addToast(err.message || "Failed to load inquiries", "error");
    } finally {
      setIsLoading(false);
    }
  }, [category, searchTerm, addToast]);

  React.useEffect(() => {
    fetchInquiries();
  }, [fetchInquiries]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchInquiries();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{title}</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">{description}</p>
        </div>
      </div>

      <Card className="border border-border">
        <CardHeader className="border-b pb-4 bg-card rounded-t-xl">
          <form onSubmit={handleSearch} className="flex gap-2 w-full max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, subject..."
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
                  <th className="px-6 py-3.5">Date</th>
                  <th className="px-6 py-3.5">Customer Name</th>
                  <th className="px-6 py-3.5">Subject</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-xs">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-muted-foreground">Loading inquiries...</td>
                  </tr>
                ) : inquiries.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-muted-foreground">No inquiries found.</td>
                  </tr>
                ) : (
                  inquiries.map((inq) => (
                    <tr key={inq._id} className="hover:bg-secondary/15 transition-colors">
                      <td className="px-6 py-4">{new Date(inq.createdAt).toLocaleDateString()}</td>
                      <td className="px-6 py-4">
                        <p className="font-bold">{inq.firstName} {inq.lastName}</p>
                        <p className="text-muted-foreground">{inq.email}</p>
                      </td>
                      <td className="px-6 py-4 font-medium">{inq.subject}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded-full font-bold ${
                           inq.status === "closed" ? "bg-gray-100 text-gray-700" :
                           inq.status === "in_progress" ? "bg-blue-100 text-blue-700" :
                           "bg-amber-100 text-amber-700"
                        }`}>{inq.status.replace("_", " ")}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-8 w-8 p-0" 
                          title="View Inquiry"
                          onClick={() => {
                            setSelectedInquiry(inq);
                            setIsModalOpen(true);
                          }}
                        >
                          <Eye className="h-3.5 w-3.5" />
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

      <InquiryDetailsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          setIsModalOpen(false);
          fetchInquiries();
        }}
        inquiry={selectedInquiry}
      />
    </div>
  );
}
