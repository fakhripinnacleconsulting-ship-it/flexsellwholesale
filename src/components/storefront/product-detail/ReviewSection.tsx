"use client";

import * as React from "react";
import Link from "next/link";
import { Star, MessageSquare, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useProductDetail } from "./ProductDetailContext";

export function ReviewSection() {
  const {
    product,
    reviewsList,
    isReviewsLoading,
    activeUser,
    reviewRating,
    setReviewRating,
    reviewTitle,
    setReviewTitle,
    reviewComment,
    setReviewComment,
    isSubmittingReview,
    handleSubmitReview
  } = useProductDetail();

  if (!product) return null;

  return (
    <div className="border-t pt-8 space-y-6 mt-8">
      <div>
        <h3 className="text-xl font-bold tracking-tight">Customer Ratings & Reviews</h3>
        <p className="text-muted-foreground text-xs">Verify authentic purchase feedback from fellow wholesale distributors.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        {/* Ratings Summary Box */}
        <div className="border rounded-xl p-5 bg-card flex flex-col items-center justify-center text-center">
          <span className="text-4xl font-extrabold text-foreground">{product.rating || 0}</span>
          <div className="flex items-center gap-0.5 mt-1.5">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                size={18}
                className={`${
                  s <= Math.round(product.rating || 4.5)
                    ? "text-yellow-500 fill-yellow-500"
                    : "text-muted-foreground/30"
                }`}
              />
            ))}
          </div>
          <span className="text-xs text-muted-foreground mt-2 font-semibold">
            Based on {product.reviewCount || 0} approved B2B reviews
          </span>
        </div>

        {/* Reviews List */}
        <div className="md:col-span-2 space-y-4">
          <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Buyer Reviews List:</h4>
          
          {isReviewsLoading ? (
            <p className="text-muted-foreground text-xs">Loading reviews...</p>
          ) : reviewsList.length === 0 ? (
            <div className="text-center p-6 border border-dashed rounded-lg bg-secondary/5">
              <MessageSquare className="mx-auto h-8 w-8 text-muted-foreground/45 mb-2" />
              <p className="text-muted-foreground text-xs">No reviews have been approved for this product yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {reviewsList.map((rev) => (
                <div key={rev._id} className="border rounded-xl p-4 bg-card space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-xs">{rev.customerName}</span>
                      <span className="text-[10px] text-muted-foreground ml-2">
                        {new Date(rev.createdAt).toLocaleDateString()}
                      </span>
                    </div>
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
                  </div>
                  <h5 className="font-bold text-sm text-foreground">{rev.title}</h5>
                  <p className="text-muted-foreground text-xs leading-relaxed">{rev.comment}</p>
                  
                  {rev.adminResponse && (
                    <div className="bg-secondary/30 p-3 rounded-lg border border-l-4 border-l-primary text-xs mt-3 space-y-1">
                      <span className="font-bold text-primary flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Platform Admin Response:
                      </span>
                      <p className="text-muted-foreground italic">{rev.adminResponse}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Write Review Form */}
          {activeUser ? (
            <Card className="border border-border mt-6">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold">Write a B2B Product Review</CardTitle>
                <CardDescription className="text-xs">
                  Only verified purchasers are eligible to submit reviews. Reviews require admin moderation.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmitReview} className="space-y-4 text-xs">
                  <div className="space-y-1.5">
                    <label className="font-bold text-muted-foreground">Rating Stars</label>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setReviewRating(star)}
                          className="focus:outline-none hover:scale-110 transition-transform cursor-pointer"
                        >
                          <Star
                            size={24}
                            className={`${
                              star <= reviewRating
                                ? "text-yellow-500 fill-yellow-500"
                                : "text-muted-foreground/30"
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-bold text-muted-foreground">Review Title *</label>
                    <Input
                      placeholder="e.g. Excellent build quality, High margin potential"
                      value={reviewTitle}
                      onChange={(e) => setReviewTitle(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-bold text-muted-foreground">Detailed Comments *</label>
                    <textarea
                      placeholder="Please provide honest wholesale feedback regarding plastic grades, packaging durability, or sizing margins."
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      required
                      rows={3}
                      className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </div>
                  <Button type="submit" size="sm" className="font-bold cursor-pointer" disabled={isSubmittingReview}>
                    {isSubmittingReview ? "Submitting..." : "Submit Review for Verification"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : (
            <Card className="border border-border/80 bg-secondary/5 mt-6">
              <CardContent className="p-4 text-center text-xs text-muted-foreground">
                Please <Link href="/login" className="text-primary font-bold hover:underline">Log In</Link> to write a verified review.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
