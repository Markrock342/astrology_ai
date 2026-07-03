import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl flex-1 px-6 py-16">
      <Link href="/login" className="mb-8 inline-block">
        <BrandLogo size={36} />
      </Link>
      <h1 className="text-2xl font-semibold text-[var(--foreground)]">
        นโยบายความเป็นส่วนตัว
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-[var(--muted)]">
        Horasard (โหราศาสตร์) เก็บข้อมูลที่จำเป็นเพื่อให้บริการดูดวงและสนทนากับ AI
        เช่น อีเมล ชื่อผู้ใช้ ข้อมูลวันเกิด และประวัติการสนทนา เราไม่ขายข้อมูลส่วนบุคคลให้บุคคลที่สาม
      </p>
      <p className="mt-4 text-sm leading-relaxed text-[var(--muted)]">
        คุณสามารถแก้ไขวันเกิดได้จำกัดจำนวนครั้งตามที่ระบบกำหนด และขอลบบัญชีได้โดยติดต่อทีมงาน
      </p>
      <p className="mt-6 text-xs text-[var(--muted-2)]">
        เอกสารฉบับเต็มจะอัปเดตก่อนเปิดให้บริการจริง (Milestone 4)
      </p>
      <Link
        href="/login"
        className="mt-8 inline-block text-sm text-[var(--primary)] hover:underline"
      >
        ← กลับไปหน้าเข้าสู่ระบบ
      </Link>
    </main>
  );
}
