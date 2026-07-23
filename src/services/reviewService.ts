import { apiClient, isMockMode } from "@/lib/apiClient";
import { Review } from "@/types";
import { dispatchEvent } from "@/lib/events/eventDispatcher";

const REVIEWS_STORAGE_KEY = "flexsell-reviews-storage";

function getLocalReviews(): Review[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(REVIEWS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error("Failed to read reviews from localStorage", err);
    return [];
  }
}

function saveLocalReviews(reviews: Review[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(REVIEWS_STORAGE_KEY, JSON.stringify(reviews));
  } catch (err) {
    console.error("Failed to save reviews to localStorage", err);
  }
}

export const reviewService = {
  async getProductReviews(productId: string): Promise<Review[]> {
    if (isMockMode) {
      return getLocalReviews().filter(r => r.productId === productId && r.status === "approved");
    }
    return apiClient.get<Review[]>(`/reviews?productId=${productId}`);
  },

  async getCustomerReviews(): Promise<Review[]> {
    if (isMockMode) {
      return getLocalReviews();
    }
    return apiClient.get<Review[]>("/reviews");
  },

  async submitReview(data: { productId: string; rating: number; title: string; comment: string }): Promise<Review> {
    if (isMockMode) {
      const reviews = getLocalReviews();
      const newReview: Review = {
        _id: "rev-" + Date.now(),
        productId: data.productId,
        customerName: "Anonymous B2B Client",
        rating: data.rating,
        title: data.title,
        comment: data.comment,
        status: "pending",
        createdAt: new Date().toISOString()
      };
      saveLocalReviews([newReview, ...reviews]);

      dispatchEvent({
        eventType: "REVIEW_SUBMITTED",
        category: "system",
        actor: { id: "current-user", name: newReview.customerName, role: "customer" },
        recipient: { customerId: "admin", role: "admin" },
        entity: { type: "review", id: newReview._id },
        data: newReview,
      });

      return newReview;
    }
    return apiClient.post<Review>("/reviews", data);
  },

  async deleteReview(id: string): Promise<void> {
    if (isMockMode) {
      const reviews = getLocalReviews();
      saveLocalReviews(reviews.filter(r => r._id !== id));
      return;
    }
    return apiClient.delete<void>(`/reviews?id=${id}`);
  },

  async getAllReviewsAdmin(): Promise<Review[]> {
    if (isMockMode) {
      return getLocalReviews();
    }
    return apiClient.get<Review[]>("/admin/reviews");
  },

  async moderateReviewAdmin(id: string, status: "pending" | "approved" | "rejected", adminResponse?: string): Promise<Review> {
    if (isMockMode) {
      const reviews = getLocalReviews();
      let updatedReview: Review | null = null;
      const updatedList = reviews.map(r => {
        if (r._id === id) {
          updatedReview = { ...r, status, adminResponse };
          return updatedReview;
        }
        return r;
      });
      saveLocalReviews(updatedList);
      if (!updatedReview) throw new Error("Review not found");
      return updatedReview;
    }
    return apiClient.put<Review>("/admin/reviews", { _id: id, status, adminResponse });
  },

  async deleteReviewAdmin(id: string): Promise<void> {
    if (isMockMode) {
      const reviews = getLocalReviews();
      saveLocalReviews(reviews.filter(r => r._id !== id));
      return;
    }
    return apiClient.delete<void>(`/admin/reviews?id=${id}`);
  }
};
