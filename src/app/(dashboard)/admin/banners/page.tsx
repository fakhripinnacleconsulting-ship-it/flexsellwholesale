import { redirect } from "next/navigation";

export default function AdminBannersPage() {
  redirect("/admin/cms?tab=hero");
}
