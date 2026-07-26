import { redirect } from "next/navigation";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

/** Minimal shell for admin TOTP setup/verify (outside gated /admin layout). */
export default async function Admin2faLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user) redirect("/login");
  if (role !== "ADMIN" && role !== "SUPER_ADMIN") redirect("/dashboard");
  return (
    <div className="min-h-dvh bg-[var(--background)] text-[var(--foreground)]">
      {children}
    </div>
  );
}
