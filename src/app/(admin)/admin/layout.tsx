import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AdminShell } from "@/components/admin/admin-shell";

/**
 * Admin CMS shell (spec 6). Server-side role guard: only ADMIN / SUPER_ADMIN.
 * Every admin API route must ALSO authorize server-side (defense in depth).
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user) redirect("/login");
  if (role !== "ADMIN" && role !== "SUPER_ADMIN") redirect("/dashboard");

  return (
    <AdminShell userName={session.user.name} userRole={role}>
      {children}
    </AdminShell>
  );
}
