import Link from "next/link";
import { APP_NAME_TH } from "@/config/constants";

/**
 * Public landing page (spec 5.1). Frontend task: build out hero, categories,
 * Free vs Pro comparison, how-it-works, FAQ, footer. This is a minimal shell.
 */
export default function LandingPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <span className="mb-4 text-xs uppercase tracking-[0.3em] text-[var(--accent)]">
        AI Horoscope
      </span>
      <h1 className="text-4xl font-semibold sm:text-6xl">{APP_NAME_TH}</h1>
      <p className="mt-4 max-w-xl text-[var(--muted)]">
        ดูดวงด้วย AI สไตล์แม่หมอ อ่านดวงจากข้อมูลวันเกิดของคุณ อบอุ่น น่าเชื่อถือ
        และเข้าใจง่าย
      </p>
      <div className="mt-8 flex gap-3">
        <Link
          href="/register"
          className="rounded-full bg-[var(--primary)] px-6 py-3 text-sm font-medium text-[var(--primary-foreground)]"
        >
          เริ่มต้นใช้งาน
        </Link>
        <Link
          href="/login"
          className="rounded-full border border-[var(--border)] px-6 py-3 text-sm font-medium"
        >
          เข้าสู่ระบบ
        </Link>
      </div>
      <p className="mt-10 text-xs text-[var(--muted)]">
        Frontend task: landing sections · Free/Pro comparison · FAQ · footer
      </p>
    </main>
  );
}
