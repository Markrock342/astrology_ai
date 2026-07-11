import { redirect } from "next/navigation";

/** Legacy JSON preview — replaced by cookie-based live preview. */
export default function AdminPreviewRedirect() {
  redirect("/admin/landing");
}
