import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AdminShell } from "@/components/admin/admin-shell";
import { getCachedMaintenanceMode } from "@/server/auth/session-guard";
import { getAdmin2faStatus } from "@/server/auth/admin-2fa-service";

export const dynamic = "force-dynamic";

/**
 * Admin CMS shell. Server-side role guard: only ADMIN / SUPER_ADMIN.
 * TOTP step-up required after enroll (see /admin-2fa/*).
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

  const twoFa = await getAdmin2faStatus(session.user.id);
  if (!twoFa.enrolled) redirect("/admin-2fa/setup");
  if (!twoFa.verified) redirect("/admin-2fa/verify");

  const maintenance = await getCachedMaintenanceMode().catch(() => ({
    enabled: false,
    message: "",
  }));

  return (
    <AdminShell
      userName={session.user.name}
      userRole={role}
      maintenanceOn={maintenance.enabled}
    >
      {children}
    </AdminShell>
  );
}
