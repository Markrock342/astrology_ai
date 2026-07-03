import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { FEATURES } from "@/config/features";

const ADMIN_NAV = [
  { href: "/admin/dashboard", label: "ภาพรวม" },
  { href: "/admin/users", label: "ผู้ใช้" },
  { href: "/admin/categories", label: "หมวดหมู่" },
  { href: "/admin/prompts", label: "Prompt / Persona", aiOnly: true },
  { href: "/admin/ai-configs", label: "AI Models", aiOnly: true },
  { href: "/admin/knowledge", label: "คลังความรู้", aiOnly: true },
  { href: "/admin/packages", label: "แพ็กเกจ" },
  { href: "/admin/payments", label: "การชำระเงิน" },
  { href: "/admin/usage", label: "Usage / AI Logs", aiOnly: true },
  { href: "/admin/audit-logs", label: "Audit Logs" },
].filter((item) => FEATURES.aiAdmin || !item.aiOnly);

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
    <div className="flex flex-1">
      <aside className="hidden w-64 shrink-0 border-r border-[var(--border)] bg-[var(--surface)] p-6 lg:block">
        <p className="text-sm font-semibold text-[var(--accent)]">Admin CMS</p>
        <nav className="mt-6 flex flex-col gap-1">
          {ADMIN_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="flex-1">{children}</div>
    </div>
  );
}
