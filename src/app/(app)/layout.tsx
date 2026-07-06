import { Suspense } from "react";
import { AppShell } from "@/components/app/app-shell";
import { MaintenanceView } from "@/components/app/maintenance-view";
import { AppDataProvider } from "@/components/app/app-data-provider";
import { BirthProfileGate } from "@/components/app/birth-profile-gate";
import { requireSessionMe } from "@/server/auth/session-guard";
import { getMaintenanceMode } from "@/server/settings/settings-service";

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
  const [me, maintenance] = await Promise.all([requireSessionMe(), getMaintenanceMode()]);
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
