import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { APP_NAME_TH } from "@/config/constants";

const NAV = [
  { href: "/dashboard", label: "หน้าหลัก" },
  { href: "/history", label: "ประวัติการดูดวง" },
  { href: "/account", label: "บัญชี & แพ็กเกจ" },
];

/**
 * Authenticated user shell (spec 4: sidebar + content). Server-side guard
 * redirects unauthenticated visitors to /login. Frontend task: responsive
 * sidebar + mobile bottom nav + account area.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="flex flex-1">
      <aside className="hidden w-64 shrink-0 border-r border-[var(--border)] bg-[var(--surface)] p-6 md:block">
        <Link href="/dashboard" className="text-lg font-semibold text-[var(--accent)]">
          {APP_NAME_TH}
        </Link>
        <nav className="mt-8 flex flex-col gap-1">
          {NAV.map((item) => (
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
