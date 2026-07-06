import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";

/** Shown to non-admin users when maintenance mode is enabled in CMS. */
export function MaintenanceView({ message }: { message: string }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center px-6 py-16 text-center">
      <BrandLogo size={48} />
      <h1 className="mt-8 text-xl font-semibold text-[var(--foreground)]">
        ระบบปิดปรับปรุงชั่วคราว
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-[var(--muted)]">{message}</p>
      <Link
        href="/login"
        className="mt-8 text-sm text-[var(--primary)] hover:underline"
      >
        กลับไปหน้าเข้าสู่ระบบ
      </Link>
    </main>
  );
}
