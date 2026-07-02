import Link from "next/link";
import { BrandMark } from "@/components/brand-logo";
import { APP_NAME_TH } from "@/config/constants";

/**
 * Public landing page. Single entry CTA → /login (design: no separate register).
 */
export default function LandingPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <BrandMark size={56} />
      <span className="mt-6 text-xs uppercase tracking-[0.4em] text-[var(--muted-2)]">
        AI Horoscope
      </span>
      <h1 className="mt-2 text-4xl font-semibold text-[var(--primary)] sm:text-6xl">
        {APP_NAME_TH}
      </h1>
      <p className="mt-4 max-w-xl text-[var(--muted)]">
        ดูดวงด้วย AI สไตล์แม่หมอ อ่านดวงจากข้อมูลวันเกิดของคุณ อบอุ่น น่าเชื่อถือ
        และเข้าใจง่าย
      </p>
      <div className="mt-8 flex gap-3">
        <Link
          href="/login"
          className="rounded-full bg-[var(--primary)] px-6 py-3 text-sm font-semibold text-[var(--primary-foreground)] transition hover:bg-[var(--primary-hover)]"
        >
          เริ่มต้นใช้งาน
        </Link>
        <Link
          href="/login"
          className="rounded-full border border-[var(--border)] px-6 py-3 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--surface-2)]"
        >
          เข้าสู่ระบบ
        </Link>
      </div>
    </main>
  );
}
