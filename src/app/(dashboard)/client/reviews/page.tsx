"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToastStore } from "@/stores/toastStore";
import { MessageSquare, Trash2, ExternalLink, Star, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { reviewService } from "@/services/reviewService";

export default function ClientReviewsPage() {
  const { addToast } = useToastStore();
  const [reviews, setReviews] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const fetchReviews = async () => {
    try {
      setIsLoading(true);
      const data = await reviewService.getCustomerReviews();
      setReviews(data);
    } catch (err: unknown) {
      console.error(err);
      addToast((err as any).message || "Failed to load reviews", "error");
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    fetchReviews();
  }, []);

  const handleDeleteReview = async (id: string) => {
    if (!confirm("Are you sure you want to delete this review?")) return;
    try {
      await reviewService.deleteReview(id);
      addToast("Review deleted successfully", "success");
      fetchReviews();
    } catch (err: unknown) {
      addToast((err as any).message || "Failed to delete review", "error");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <span className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-500 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
            <CheckCircle className="h-3 w-3" /> Approved
          </span>
        );
      case "rejected":
        return (
          <span className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-500 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
            <XCircle className="h-3 w-3" /> Rejected
          </span>
        );
      default:
        return (
          <span className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-500 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> Pending Verification
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 container mx-auto px-4 py-8 text-foreground">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Reviews</h1>
        <p className="text-muted-foreground mt-1">Monitor the verification status of your B2B product reviews.</p>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading your reviews...</div>
      ) : reviews.length === 0 ? (
        <Card className="border border-border">
          <CardContent className="pt-10 pb-10 text-center">
            <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground/50 mb-3" />
            <h3 className="text-lg font-bold">No reviews written</h3>
            <p className="text-muted-foreground text-sm max-w-sm mx-auto mt-1 mb-6">
              You haven't left any B2B product reviews yet. Go to your orders and share your cargo feedback!
            </p>
            <Link href="/client/orders">
              <Button>Browse Purchased Products</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4 max-w-4xl">
          {reviews.map((rev) => (
            <Card key={rev._id} className="border border-border shadow-sm">
              <CardContent className="pt-6 space-y-4 text-xs">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                  <div>
                    <h3 className="text-base font-bold text-foreground flex items-center gap-1.5">
                      {rev.productTitle}
                      {rev.productSlug && (
                        <Link href={`/products/${rev.productSlug}`} target="_blank" className="text-primary hover:text-primary/80">
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      )}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            size={12}
                            className={`${
                              s <= rev.rating
                                ? "text-yellow-500 fill-yellow-500"
                                : "text-muted-foreground/30"
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-muted-foreground">•</span>
                      <span className="text-muted-foreground">Reviewed on {new Date(rev.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div>{getStatusBadge(rev.status)}</div>
                </div>

                <div className="space-y-1">
                  <h4 className="font-bold text-sm text-foreground">{rev.title}</h4>
                  <p className="text-muted-foreground leading-relaxed">{rev.comment}</p>
                </div>

                {rev.adminResponse && (
                  <div className="bg-secondary/35 p-3 rounded-lg border border-l-4 border-l-primary space-y-1">
                    <span className="font-bold text-primary flex items-center gap-1">
                      <CheckCircle className="h-3.5 w-3.5" /> Platform Admin Response:
                    </span>
                    <p className="text-muted-foreground italic">{rev.adminResponse}</p>
                  </div>
                )}

                <div className="flex justify-end pt-2 border-t">
                  <Button variant="outline" size="sm" className="h-8 text-destructive hover:bg-destructive/5 hover:text-destructive" onClick={() => handleDeleteReview(rev._id)}>
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete Review
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
