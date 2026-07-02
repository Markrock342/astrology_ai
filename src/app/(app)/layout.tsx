import { Suspense } from "react";
import { AppShell } from "@/components/app/app-shell";

/**
 * Authenticated user shell (sidebar + chat area, design 03/04).
 *
 * TODO(auth): re-enable the server-side session guard once Prisma/auth is set up:
 *   const session = await auth();
 *   if (!session?.user) redirect("/login");
 * Currently bypassed so pages are testable without a database.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
