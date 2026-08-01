import { revalidatePath, revalidateTag } from "next/cache";

export function revalidateStorefront() {
  try {
    revalidatePath("/", "layout");
  } catch (err) {
    console.error("revalidateStorefront error:", err);
  }
}

export function revalidateProducts() {
  try {
    revalidatePath("/", "layout");
  } catch (err) {
    console.error("revalidateProducts error:", err);
  }
}

export function revalidateCategories() {
  try {
    revalidatePath("/", "layout");
  } catch (err) {
    console.error("revalidateCategories error:", err);
  }
}

export function revalidateCollections() {
  try {
    revalidatePath("/", "layout");
  } catch (err) {
    console.error("revalidateCollections error:", err);
  }
}

export function revalidateCms() {
  try {
    // Bust the DATA cache (MongoDB query results) via tags
    revalidateTag("cms-policies", "max" as any);
    revalidateTag("cms-content", "max" as any);

    // Bust the PAGE cache (pre-rendered HTML) via paths
    revalidatePath("/", "layout");
  } catch (err) {
    console.error("revalidateCms error:", err);
  }
}

export function revalidateAdminDashboard() {
  try {
    revalidatePath("/", "layout");
  } catch (err) {
    console.error("revalidateAdminDashboard error:", err);
  }
}
