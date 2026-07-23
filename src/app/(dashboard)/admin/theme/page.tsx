import { redirect } from "next/navigation";

export default function AdminThemeEditorPage() {
  redirect("/admin/settings?tab=theme");
}
