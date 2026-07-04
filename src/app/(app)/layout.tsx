import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/app/app-shell";
import { AppDataProvider } from "@/components/app/app-data-provider";
import { BirthProfileGate } from "@/components/app/birth-profile-gate";
import { getMe } from "@/server/user/account-service";
import { AppError } from "@/lib/errors";

export const dynamic = "force-dynamic";

/**
 * Authenticated user shell (sidebar + chat area, design 03/04).
 * Server-side guard: unauthenticated visitors are sent to /login.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  let me;
  try {
    me = await getMe(session.user.id);
  } catch (err) {
    // Stale JWT (e.g. wrong Google provider id) — force a clean sign-in.
    if (err instanceof AppError && err.code === "NOT_FOUND") redirect("/login");
    throw err;
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
