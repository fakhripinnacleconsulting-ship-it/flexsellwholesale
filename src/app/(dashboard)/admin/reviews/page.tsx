"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToastStore } from "@/stores/toastStore";
import { useConfirmStore } from "@/stores/confirmStore";
import {
  MessageSquare,
  Star,
  Check,
  X,
  Trash2,
  ExternalLink,
  MessageCircle,
  Search,
  Eye,
  ChevronLeft,
  ChevronRight,
  Filter,
  User,
  Package,
} from "lucide-react";
import { reviewService } from "@/services/reviewService";
import { Review } from "@/types";

export default function AdminReviewsPage() {
  const { addToast } = useToastStore();
  const confirmAction = useConfirmStore((state) => state.confirm);

  const [reviews, setReviews] = React.useState<Review[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  // Filter & Search state
  const [activeTab, setActiveTab] = React.useState<"all" | "pending" | "approved" | "rejected">("all");
  const [searchTerm, setSearchTerm] = React.useState("");
  const [ratingFilter, setRatingFilter] = React.useState<number | 0>(0);
  const [currentPage, setCurrentPage] = React.useState(1);
  const ITEMS_PER_PAGE = 10;

  // View Modal State
  const [selectedReviewForView, setSelectedReviewForView] = React.useState<Review | null>(null);

  // Admin Response Modal State
  const [replyReview, setReplyReview] = React.useState<Review | null>(null);
  const [replyText, setReplyText] = React.useState("");
  const [isSubmittingReply, setIsSubmittingReply] = React.useState(false);

  const fetchReviews = async () => {
    try {
      setIsLoading(true);
      const data = await reviewService.getAllReviewsAdmin();
      setReviews(data);
    } catch (err: unknown) {
      addToast((err as any).message || "Failed to load reviews for moderation", "error");
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    fetchReviews();
  }, []);

  // Reset page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, activeTab, ratingFilter]);

  // Moderation Handlers
  const handleUpdateStatus = (id: string, newStatus: "pending" | "approved" | "rejected") => {
    const actionLabel = newStatus === "approved" ? "Approve" : newStatus === "rejected" ? "Reject" : "Set to Pending";
    confirmAction({
      title: `${actionLabel} Review`,
      message: `Are you sure you want to change the status of this review to "${newStatus}"?`,
      confirmText: actionLabel,
      type: newStatus === "approved" ? "info" : "warning",
      onConfirm: async () => {
        try {
          const updated = await reviewService.moderateReviewAdmin(id, newStatus);
          addToast(`Review status updated to ${newStatus}!`, "success");
          fetchReviews();
          // Sync open view modal if updated
          if (selectedReviewForView && selectedReviewForView._id === id) {
            setSelectedReviewForView(updated);
          }
        } catch (err: unknown) {
          addToast((err as any).message || "Failed to update review status", "error");
        }
      },
    });
  };

  const handleDeleteReview = (id: string) => {
    confirmAction({
      title: "Delete Review Permanently",
      message: "Are you sure you want to delete this review permanently? This action cannot be undone.",
      confirmText: "Delete",
      type: "danger",
      onConfirm: async () => {
        try {
          await reviewService.deleteReviewAdmin(id);
          addToast("Review deleted permanently", "success");
          if (selectedReviewForView && selectedReviewForView._id === id) {
            setSelectedReviewForView(null);
          }
          fetchReviews();
        } catch (err: unknown) {
          addToast((err as any).message || "Failed to delete review", "error");
        }
      },
    });
  };

  const handleOpenReplyModal = (review: Review) => {
    setReplyReview(review);
    setReplyText(review.adminResponse || "");
  };

  const handleSubmitReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyReview) return;

    setIsSubmittingReply(true);
    try {
      const updated = await reviewService.moderateReviewAdmin(replyReview._id, replyReview.status, replyText);
      addToast("Admin response saved successfully!", "success");
      setReplyReview(null);
      setReplyText("");
      fetchReviews();
      if (selectedReviewForView && selectedReviewForView._id === replyReview._id) {
        setSelectedReviewForView(updated);
      }
    } catch (err: unknown) {
      addToast((err as any).message || "Failed to save response", "error");
    } finally {
      setIsSubmittingReply(false);
    }
  };

  // Filtered & Paginated Reviews
  const filteredReviews = React.useMemo(() => {
    return reviews.filter((r) => {
      // Tab Filter
      if (activeTab !== "all" && r.status !== activeTab) return false;

      // Rating Filter
      if (ratingFilter > 0 && r.rating !== ratingFilter) return false;

      // Search Filter
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const matchesCustomer = r.customerName?.toLowerCase().includes(query);
        const matchesProduct = r.productTitle?.toLowerCase().includes(query) || r.productId?.toLowerCase().includes(query);
        const matchesTitle = r.title?.toLowerCase().includes(query);
        const matchesComment = r.comment?.toLowerCase().includes(query);
        return matchesCustomer || matchesProduct || matchesTitle || matchesComment;
      }

      return true;
    });
  }, [reviews, activeTab, ratingFilter, searchTerm]);

  const totalPages = Math.ceil(filteredReviews.length / ITEMS_PER_PAGE) || 1;
  const paginatedReviews = React.useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredReviews.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredReviews, currentPage]);

  const getStatusBadge = (status: Review["status"]) => {
    switch (status) {
      case "approved":
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">Approved</span>;
      case "rejected":
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-500 border border-rose-500/20">Rejected</span>;
      case "pending":
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">Pending</span>;
    }
  };

  return (
    <div className="space-y-6 container mx-auto px-4 py-8 text-foreground max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Moderate Reviews</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage customer feedback, approve B2B reviews, and publish official platform responses.
          </p>
        </div>
      </div>

      {/* Main Container Card */}
      <Card className="border border-border shadow-sm">
        {/* Search & Filter Header */}
        <CardHeader className="border-b border-border space-y-4 p-5">
          {/* Status Tabs */}
          <div className="flex border-b border-border text-xs font-bold gap-6 overflow-x-auto pb-0">
            {(["all", "pending", "approved", "rejected"] as const).map((tab) => {
              const count = reviews.filter((r) => tab === "all" || r.status === tab).length;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`pb-3 capitalize transition-all border-b-2 whitespace-nowrap cursor-pointer -mb-[2px] ${
                    activeTab === tab
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab} <span className="ml-1 text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-semibold">{count}</span>
                </button>
              );
            })}
          </div>

          {/* Search Bar & Rating Filter Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search customer, product, title..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Filter className="h-3.5 w-3.5" />
                <span className="font-semibold">Rating:</span>
                <select
                  value={ratingFilter}
                  onChange={(e) => setRatingFilter(Number(e.target.value))}
                  className="bg-background text-foreground text-xs font-medium px-2.5 py-1.5 border border-input rounded-md cursor-pointer h-9 focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value={0}>All Ratings</option>
                  <option value={5}>5 Stars ★★★★★</option>
                  <option value={4}>4 Stars ★★★★☆</option>
                  <option value={3}>3 Stars ★★★☆☆</option>
                  <option value={2}>2 Stars ★★☆☆☆</option>
                  <option value={1}>1 Star ★☆☆☆☆</option>
                </select>
              </div>
            </div>
          </div>
        </CardHeader>

        {/* Data Table Content */}
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-16 text-muted-foreground text-sm flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
              <span>Loading reviews for moderation...</span>
            </div>
          ) : paginatedReviews.length === 0 ? (
            <div className="text-center py-16 px-4">
              <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground/40 mb-3" />
              <h3 className="text-base font-bold text-foreground">No reviews found</h3>
              <p className="text-muted-foreground text-xs mt-1 max-w-sm mx-auto">
                No customer reviews match your current search and filter criteria.
              </p>
              {(searchTerm || ratingFilter > 0 || activeTab !== "all") && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 text-xs font-semibold"
                  onClick={() => {
                    setSearchTerm("");
                    setRatingFilter(0);
                    setActiveTab("all");
                  }}
                >
                  Reset Filters
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-secondary/40 border-b border-border text-muted-foreground font-semibold text-[11px] uppercase tracking-wider">
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Product</th>
                    <th className="py-3 px-4">Rating</th>
                    <th className="py-3 px-4">Review Summary</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paginatedReviews.map((rev) => (
                    <tr key={rev._id} className="hover:bg-secondary/20 transition-colors">
                      {/* Customer Info */}
                      <td className="py-3.5 px-4 align-top">
                        <div className="space-y-0.5">
                          <div className="font-bold text-foreground flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span>{rev.customerName || "Anonymous B2B Client"}</span>
                          </div>
                          <div className="text-[11px] text-muted-foreground pl-5">
                            {rev.createdAt ? new Date(rev.createdAt).toLocaleDateString() : "N/A"}
                          </div>
                        </div>
                      </td>

                      {/* Product Info */}
                      <td className="py-3.5 px-4 align-top">
                        <div className="space-y-0.5 max-w-xs">
                          <div className="font-bold text-foreground flex items-center gap-1">
                            <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="truncate">{rev.productTitle || rev.productId}</span>
                          </div>
                          {rev.productSlug && (
                            <Link
                              href={`/products/${rev.productSlug}`}
                              target="_blank"
                              className="text-[11px] text-primary hover:underline inline-flex items-center gap-1 pl-4 font-medium"
                            >
                              <span>View Product</span>
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          )}
                        </div>
                      </td>

                      {/* Rating */}
                      <td className="py-3.5 px-4 align-top">
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              size={13}
                              className={s <= rev.rating ? "text-amber-500 fill-amber-500" : "text-muted-foreground/30"}
                            />
                          ))}
                        </div>
                        <span className="text-[10px] text-muted-foreground font-semibold mt-0.5 block">
                          {rev.rating} / 5 Stars
                        </span>
                      </td>

                      {/* Review Summary */}
                      <td className="py-3.5 px-4 align-top max-w-md">
                        <div className="space-y-1">
                          <div className="font-bold text-foreground truncate">{rev.title}</div>
                          <p className="text-muted-foreground line-clamp-2 leading-relaxed text-[11px]">
                            {rev.comment}
                          </p>
                          {rev.adminResponse && (
                            <div className="inline-flex items-center gap-1 text-[10px] text-primary font-bold bg-primary/10 px-2 py-0.5 rounded">
                              <MessageCircle className="h-3 w-3" /> Admin Replied
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Status Badge */}
                      <td className="py-3.5 px-4 align-top">
                        {getStatusBadge(rev.status)}
                      </td>

                      {/* Row Action Buttons */}
                      <td className="py-3.5 px-4 align-top text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View Details */}
                          <Button
                            variant="ghost"
                            size="sm"
                            title="View Full Review"
                            onClick={() => setSelectedReviewForView(rev)}
                            className="h-8 w-8 p-0 cursor-pointer hover:bg-secondary text-muted-foreground hover:text-foreground"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>

                          {/* Moderate Status Quick Actions */}
                          {rev.status !== "approved" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Approve Review"
                              onClick={() => handleUpdateStatus(rev._id, "approved")}
                              className="h-8 w-8 p-0 cursor-pointer text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                          )}

                          {rev.status !== "rejected" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Reject Review"
                              onClick={() => handleUpdateStatus(rev._id, "rejected")}
                              className="h-8 w-8 p-0 cursor-pointer text-rose-600 hover:text-rose-700 hover:bg-rose-500/10"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}

                          {/* Admin Reply */}
                          <Button
                            variant="ghost"
                            size="sm"
                            title={rev.adminResponse ? "Edit Admin Response" : "Add Admin Response"}
                            onClick={() => handleOpenReplyModal(rev)}
                            className="h-8 w-8 p-0 cursor-pointer text-primary hover:bg-primary/10"
                          >
                            <MessageCircle className="h-4 w-4" />
                          </Button>

                          {/* Delete */}
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Delete Review"
                            onClick={() => handleDeleteReview(rev._id)}
                            className="h-8 w-8 p-0 cursor-pointer text-destructive hover:bg-destructive/10"
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

          {/* Table Footer with Pagination */}
          {!isLoading && filteredReviews.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-border text-xs text-muted-foreground">
              <div>
                Showing <span className="font-bold text-foreground">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to{" "}
                <span className="font-bold text-foreground">{Math.min(currentPage * ITEMS_PER_PAGE, filteredReviews.length)}</span> of{" "}
                <span className="font-bold text-foreground">{filteredReviews.length}</span> entries
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  className="h-8 px-2.5 cursor-pointer"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                </Button>
                <span className="text-xs font-semibold px-2 text-foreground">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  className="h-8 px-2.5 cursor-pointer"
                >
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* VIEW DETAILS MODAL */}
      {selectedReviewForView && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl max-w-2xl w-full shadow-2xl overflow-hidden p-6 text-foreground space-y-6 animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-border pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold tracking-tight">Review Details</h3>
                  {getStatusBadge(selectedReviewForView.status)}
                </div>
                <p className="text-muted-foreground text-xs mt-0.5">
                  Submitted on {selectedReviewForView.createdAt ? new Date(selectedReviewForView.createdAt).toLocaleString() : "N/A"}
                </p>
              </div>
              <button
                onClick={() => setSelectedReviewForView(null)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-secondary cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-secondary/30 p-4 rounded-lg border border-border text-xs">
              <div>
                <span className="text-muted-foreground font-semibold block">Customer Name</span>
                <span className="font-bold text-foreground text-sm flex items-center gap-1.5 mt-0.5">
                  <User className="h-3.5 w-3.5 text-primary" />
                  {selectedReviewForView.customerName || "Anonymous B2B Client"}
                </span>
              </div>

              <div>
                <span className="text-muted-foreground font-semibold block">Target Product</span>
                <div className="font-bold text-foreground text-sm flex items-center gap-1.5 mt-0.5">
                  <Package className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span>{selectedReviewForView.productTitle || selectedReviewForView.productId}</span>
                  {selectedReviewForView.productSlug && (
                    <Link href={`/products/${selectedReviewForView.productSlug}`} target="_blank" className="text-primary hover:underline">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </div>
              </div>

              <div>
                <span className="text-muted-foreground font-semibold block">Rating Given</span>
                <div className="flex items-center gap-1 mt-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      size={14}
                      className={s <= selectedReviewForView.rating ? "text-amber-500 fill-amber-500" : "text-muted-foreground/30"}
                    />
                  ))}
                  <span className="font-bold text-foreground ml-1">{selectedReviewForView.rating} / 5</span>
                </div>
              </div>

              <div>
                <span className="text-muted-foreground font-semibold block">Review ID</span>
                <span className="font-mono text-muted-foreground text-xs mt-1 block">{selectedReviewForView._id}</span>
              </div>
            </div>

            {/* Title & Comment Content */}
            <div className="space-y-2 text-xs">
              <h4 className="text-base font-bold text-foreground">{selectedReviewForView.title}</h4>
              <p className="text-muted-foreground leading-relaxed bg-secondary/20 p-3.5 rounded-md border border-border whitespace-pre-wrap">
                {selectedReviewForView.comment}
              </p>
            </div>

            {/* Existing Platform Response */}
            {selectedReviewForView.adminResponse && (
              <div className="bg-primary/5 p-4 rounded-lg border border-l-4 border-l-primary space-y-1 text-xs">
                <span className="font-bold text-primary flex items-center gap-1">
                  <MessageCircle className="h-3.5 w-3.5" /> Administrator Response:
                </span>
                <p className="text-foreground italic leading-relaxed">{selectedReviewForView.adminResponse}</p>
              </div>
            )}

            {/* Quick Actions Footer inside Modal */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-border">
              <div className="flex items-center gap-2">
                {selectedReviewForView.status !== "approved" && (
                  <Button
                    size="sm"
                    className="h-8 font-bold flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                    onClick={() => handleUpdateStatus(selectedReviewForView._id, "approved")}
                  >
                    <Check className="h-3.5 w-3.5" /> Approve
                  </Button>
                )}

                {selectedReviewForView.status !== "rejected" && (
                  <Button
                    size="sm"
                    className="h-8 font-bold flex items-center gap-1 bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
                    onClick={() => handleUpdateStatus(selectedReviewForView._id, "rejected")}
                  >
                    <X className="h-3.5 w-3.5" /> Reject
                  </Button>
                )}

                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 font-bold flex items-center gap-1 cursor-pointer"
                  onClick={() => handleOpenReplyModal(selectedReviewForView)}
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  {selectedReviewForView.adminResponse ? "Edit Response" : "Add Response"}
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 font-bold text-destructive hover:bg-destructive/10 cursor-pointer"
                  onClick={() => handleDeleteReview(selectedReviewForView._id)}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setSelectedReviewForView(null)}
                  className="h-8 font-bold cursor-pointer"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADMIN REPLY MODAL */}
      {replyReview && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl max-w-lg w-full shadow-2xl p-6 text-foreground space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-bold tracking-tight">Administrator Response</h3>
                <p className="text-muted-foreground text-xs mt-0.5">
                  Publish a verified response to {replyReview.customerName || "buyer"}'s review.
                </p>
              </div>
              <button
                onClick={() => setReplyReview(null)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-secondary cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitReply} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-bold text-muted-foreground">Response Message *</label>
                <textarea
                  placeholder="e.g., Thank you for your feedback. We have verified this with our quality assurance team..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  required
                  rows={4}
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setReplyReview(null)}
                  className="cursor-pointer"
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmittingReply} className="cursor-pointer font-bold">
                  {isSubmittingReply ? "Saving Response..." : "Save Response"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
