import { redirect } from "next/navigation";

/** /admin → default admin landing page. */
export default function AdminIndexPage() {
  redirect("/admin/dashboard");
}
