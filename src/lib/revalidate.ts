import { revalidatePath, revalidateTag } from "next/cache";

export function revalidateStorefront() {
  try {
    revalidatePath("/");
    revalidatePath("/catalog");
  } catch (err) {
    console.error("revalidateStorefront error:", err);
  }
}

export function revalidateProducts(productIdOrSlug?: string) {
  try {
    revalidateTag("products", "max" as any);
    revalidatePath("/");
    revalidatePath("/products");
    revalidatePath("/catalog");
    if (productIdOrSlug) {
      revalidatePath(`/products/${productIdOrSlug}`);
    }
  } catch (err) {
    console.error("revalidateProducts error:", err);
  }
}

export function revalidateCategories(categoryIdOrSlug?: string) {
  try {
    revalidateTag("categories", "max" as any);
    revalidatePath("/");
    revalidatePath("/categories");
    revalidatePath("/catalog");
    if (categoryIdOrSlug) {
      revalidatePath(`/categories/${categoryIdOrSlug}`);
    }
  } catch (err) {
    console.error("revalidateCategories error:", err);
  }
}

export function revalidateCollections(collectionIdOrSlug?: string) {
  try {
    revalidateTag("collections", "max" as any);
    revalidatePath("/");
    revalidatePath("/collections");
    if (collectionIdOrSlug) {
      revalidatePath(`/collections/${collectionIdOrSlug}`);
    }
  } catch (err) {
    console.error("revalidateCollections error:", err);
  }
}

export function revalidateCms() {
  try {
    revalidateTag("cms-policies", "max" as any);
    revalidateTag("cms-content", "max" as any);
    revalidatePath("/");
    revalidatePath("/policies");
    revalidatePath("/about");
    revalidatePath("/contact");
  } catch (err) {
    console.error("revalidateCms error:", err);
  }
}

export function revalidateAdminDashboard() {
  try {
    revalidatePath("/admin");
    revalidatePath("/admin/orders");
    revalidatePath("/admin/dashboard");
  } catch (err) {
    console.error("revalidateAdminDashboard error:", err);
  }
}

