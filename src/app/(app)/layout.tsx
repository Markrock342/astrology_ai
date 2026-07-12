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
 * Authenticated user shell (sidebar + chat area).
 * Session + birth-profile gate only on the server; full bootstrap
 * (me/threads/categories) loads on the client so navigation paints fast.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const shell = await requireSessionShell();
  const maintenance = await getCachedMaintenanceMode();
  const isAdmin = shell.role === "ADMIN" || shell.role === "SUPER_ADMIN";

  if (maintenance.enabled && !isAdmin) {
    return <MaintenanceView message={maintenance.message} />;
  }

  return (
    <AppDataProvider initialData={null}>
      <BirthProfileGate hasBirthProfile={shell.hasBirthProfile}>
        <Suspense fallback={null}>
          <AppShell>{children}</AppShell>
        </Suspense>
      </BirthProfileGate>
    </AppDataProvider>
  );
}
