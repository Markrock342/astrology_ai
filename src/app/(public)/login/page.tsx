import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { env } from "@/config/env";
import { BrandLogo } from "@/components/brand-logo";
import { SignInForm } from "@/components/auth/sign-in-form";
import { resolveAppEntryPath } from "@/server/auth/app-entry";

// Reads the session (cookies) and redirects when already signed in, so it must
// render per-request — never statically prerendered at build time.
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user?.id) {
    redirect(await resolveAppEntryPath(session.user.id));
  }

  const googleEnabled = Boolean(env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET);

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <BrandLogo size={44} className="mb-10" />
      <SignInForm googleEnabled={googleEnabled} />
    </main>
  );
}
