import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { MaintenanceView } from "@/components/app/maintenance-view";
import {
  AppDataProvider,
  type AppBootstrapPayload,
} from "@/components/app/app-data-provider";
import { BirthProfileGate } from "@/components/app/birth-profile-gate";
import { AppError } from "@/lib/errors";
import {
  getCachedAppBootstrap,
  serializeAppBootstrap,
} from "@/server/app/bootstrap-service";
import {
  getCachedMaintenanceMode,
  requireSessionShell,
} from "@/server/auth/session-guard";

export const dynamic = "force-dynamic";

/**
 * Authenticated user shell (sidebar + chat area).
 * Bootstrap loads on the server (cached 15s) so the sidebar has real
 * user/threads even when a client refetch fails during local dev.
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

  let initialData: AppBootstrapPayload;
  try {
    initialData = serializeAppBootstrap(
      await getCachedAppBootstrap(shell.id),
    ) as AppBootstrapPayload;
  } catch (err) {
    if (
      err instanceof AppError &&
      (err.code === "UNAUTHENTICATED" || err.code === "NOT_FOUND")
    ) {
      redirect("/login?reason=session_expired");
    }
    throw err;
  }

  return (
    <AppDataProvider initialData={initialData}>
      <BirthProfileGate hasBirthProfile={shell.hasBirthProfile}>
        <Suspense fallback={null}>
          <AppShell>{children}</AppShell>
        </Suspense>
      </BirthProfileGate>
    </AppDataProvider>
  );
}
