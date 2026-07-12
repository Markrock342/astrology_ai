import { Suspense } from "react";
import { AppShell } from "@/components/app/app-shell";
import { MaintenanceView } from "@/components/app/maintenance-view";
import { AppDataProvider } from "@/components/app/app-data-provider";
import { BirthProfileGate } from "@/components/app/birth-profile-gate";
import {
  getCachedMaintenanceMode,
  requireSessionUserId,
} from "@/server/auth/session-guard";
import { getCachedAppBootstrap, serializeAppBootstrap } from "@/server/app/bootstrap-service";
import { AppError } from "@/lib/errors";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Authenticated user shell (sidebar + chat area).
 * Loads bootstrap on the server so the sidebar is not blank until a client fetch.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const userId = await requireSessionUserId();

  let bootstrap: ReturnType<typeof serializeAppBootstrap>;
  let maintenance: Awaited<ReturnType<typeof getCachedMaintenanceMode>>;
  try {
    const [bootstrapRaw, maintenanceMode] = await Promise.all([
      getCachedAppBootstrap(userId),
      getCachedMaintenanceMode(),
    ]);
    bootstrap = serializeAppBootstrap(bootstrapRaw);
    maintenance = maintenanceMode;
  } catch (err) {
    if (err instanceof AppError && err.code === "NOT_FOUND") redirect("/login");
    throw err;
  }

  const isAdmin =
    bootstrap.me.role === "ADMIN" || bootstrap.me.role === "SUPER_ADMIN";

  if (maintenance.enabled && !isAdmin) {
    return <MaintenanceView message={maintenance.message} />;
  }

  if (bootstrap.me.status === "DISABLED") redirect("/login");

  return (
    <AppDataProvider initialData={bootstrap}>
      <BirthProfileGate hasBirthProfile={bootstrap.me.hasBirthProfile}>
        <Suspense fallback={null}>
          <AppShell>{children}</AppShell>
        </Suspense>
      </BirthProfileGate>
    </AppDataProvider>
  );
}
