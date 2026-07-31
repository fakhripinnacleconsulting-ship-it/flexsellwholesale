import { revalidatePath, revalidateTag } from "next/cache";

export function revalidateStorefront() {
  try {
    revalidatePath("/", "layout");
    revalidatePath("/products", "layout");
    revalidatePath("/categories", "layout");
    revalidatePath("/collections", "layout");
  } catch (err) {
    console.error("revalidateStorefront error:", err);
  }
}

export function revalidateProducts() {
  try {
    revalidatePath("/", "page");
    revalidatePath("/products", "layout");
    revalidatePath("/categories", "layout");
    revalidatePath("/collections", "layout");
  } catch (err) {
    console.error("revalidateProducts error:", err);
  }
}

export function revalidateCategories() {
  try {
    revalidatePath("/", "page");
    revalidatePath("/categories", "layout");
    revalidatePath("/products", "layout");
  } catch (err) {
    console.error("revalidateCategories error:", err);
  }
}

export function revalidateCollections() {
  try {
    revalidatePath("/", "page");
    revalidatePath("/collections", "layout");
  } catch (err) {
    console.error("revalidateCollections error:", err);
  }
}

export function revalidateCms() {
  try {
    // Layer 1: Bust the DATA cache (MongoDB query results) via tags
    revalidateTag("cms-policies", "max");
    revalidateTag("cms-content", "max");

    // Layer 2: Bust the PAGE cache (pre-rendered HTML) via paths
    revalidatePath("/", "page");
    revalidatePath("/policies/privacy", "page");
    revalidatePath("/policies/terms", "page");
    revalidatePath("/policies/shipping", "page");
    revalidatePath("/policies/return", "page");
    revalidatePath("/about", "page");
    revalidatePath("/contact", "page");
    revalidatePath("/faq", "page");
    revalidatePath("/dropshipping", "page");

  } catch (err) {
    console.error("revalidateCms error:", err);
  }
}

export function revalidateAdminDashboard() {
  try {
    revalidatePath("/admin", "page");
  } catch (err) {
    console.error("revalidateAdminDashboard error:", err);
  }
}
