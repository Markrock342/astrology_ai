import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { env } from "@/config/env";
import { BrandLogo } from "@/components/brand-logo";
import { AuthPanels } from "@/components/auth/auth-panels";
import { resolveAppEntryPath } from "@/server/auth/app-entry";
import { getConsentTexts } from "@/server/settings/settings-service";
import { prisma } from "@/server/db";

// Reads the session (cookies) and redirects when already signed in, so it must
// render per-request — never statically prerendered at build time.
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user?.id) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, status: true },
    });
    if (user && user.status !== "DISABLED") {
      redirect(await resolveAppEntryPath(session.user.id));
    }
  }

  const googleEnabled = Boolean(env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET);
  const { register: consentRegister } = await getConsentTexts();

  return (
    <main className="relative flex flex-1 flex-col items-center justify-center px-6 py-12">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(201,162,75,0.07),transparent_65%)]"
        aria-hidden
      />
      <BrandLogo size={44} className="relative mb-8" />
      <div className="relative w-full flex justify-center">
        <AuthPanels
          googleEnabled={googleEnabled}
          consentRegisterLabel={consentRegister.text}
        />
      </div>
    </main>
  );
}
