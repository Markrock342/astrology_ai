import { Suspense } from "react";
import { AppShell } from "@/components/app/app-shell";
import { AppDataProvider } from "@/components/app/app-data-provider";
import { BirthProfileGate } from "@/components/app/birth-profile-gate";
import { requireSessionMe } from "@/server/auth/session-guard";

export const dynamic = "force-dynamic";

/**
 * Authenticated user shell (sidebar + chat area, design 03/04).
 * Server-side guard: unauthenticated or stale sessions go to /login.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const me = await requireSessionMe();

  return (
    <AppDataProvider>
      <BirthProfileGate hasBirthProfile={me.hasBirthProfile}>
        <Suspense fallback={null}>
          <AppShell>{children}</AppShell>
        </Suspense>
      </BirthProfileGate>
    </AppDataProvider>
  );
}
