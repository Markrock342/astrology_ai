import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { env } from "@/config/env";
import { BrandLogo } from "@/components/brand-logo";
import { AuthPanels } from "@/components/auth/auth-panels";
import { AppError } from "@/lib/errors";
import { resolveAppEntryPath } from "@/server/auth/app-entry";
import { getMe } from "@/server/user/account-service";

// Reads the session (cookies) and redirects when already signed in, so it must
// render per-request — never statically prerendered at build time.
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user?.id) {
    try {
      await getMe(session.user.id);
      redirect(await resolveAppEntryPath(session.user.id));
    } catch (err) {
      // Stale JWT — show login form instead of bouncing in a redirect loop.
      if (!(err instanceof AppError && err.code === "NOT_FOUND")) throw err;
    }
  }

  const googleEnabled = Boolean(env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET);

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <BrandLogo size={44} className="mb-10" />
      <AuthPanels googleEnabled={googleEnabled} />
    </main>
  );
}
