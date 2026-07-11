import { Suspense } from "react";
import { AppShell } from "@/components/app/app-shell";
import { MaintenanceView } from "@/components/app/maintenance-view";
import { AppDataProvider } from "@/components/app/app-data-provider";
import { BirthProfileGate } from "@/components/app/birth-profile-gate";
import {
  getCachedMaintenanceMode,
  requireSessionShell,
} from "@/server/auth/session-guard";

export const dynamic = "force-dynamic";

/**
 * Authenticated user shell (sidebar + chat area, design 03/04).
 * Server-side guard: unauthenticated or stale sessions go to /login.
 * Uses a light shell query (not full getMe) so navigations stay snappy.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [me, maintenance] = await Promise.all([
    requireSessionShell(),
    getCachedMaintenanceMode(),
  ]);
  const isAdmin = me.role === "ADMIN" || me.role === "SUPER_ADMIN";

  if (maintenance.enabled && !isAdmin) {
    return <MaintenanceView message={maintenance.message} />;
  }

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
