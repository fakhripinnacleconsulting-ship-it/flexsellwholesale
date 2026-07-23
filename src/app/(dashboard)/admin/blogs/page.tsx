import { redirect } from "next/navigation";

export default function AdminBlogsPage() {
  redirect("/admin/cms?tab=blogs");
}
