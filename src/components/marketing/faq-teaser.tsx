import Link from "next/link";
import { SimpleMarkdown } from "@/components/cms/simple-markdown";

export type FaqTeaserItem = {
  id: string;
  question: string;
  answer: string;
};

export function FaqTeaser({ items }: { items: FaqTeaserItem[] }) {
  const shown = items.slice(0, 6);
  if (shown.length === 0) return null;

  return (
    <section className="border-t border-[var(--border)] bg-[var(--surface)]/40 px-6 py-20">
      <div className="mx-auto max-w-3xl">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-[var(--foreground)] sm:text-3xl">
            คำถามที่พบบ่อย
          </h2>
          <p className="mt-3 text-sm text-[var(--muted)]">
            คำตอบสั้น ๆ ก่อนเริ่มใช้งาน — ดูทั้งหมดได้ในหน้าช่วยเหลือ
          </p>
        </div>

        <div className="mt-10 space-y-3">
          {shown.map((item) => (
            <details
              key={item.id}
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 py-4"
            >
              <summary className="cursor-pointer text-sm font-medium text-[var(--foreground)]">
                {item.question}
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
                <SimpleMarkdown text={item.answer} />
              </p>
            </details>
          ))}
        </div>

        <p className="mt-8 text-center">
          <Link
            href="/help"
            className="text-sm font-medium text-[var(--primary)] underline-offset-2 hover:underline"
          >
            ดูคำถามทั้งหมด →
          </Link>
        </p>
      </div>
    </section>
  );
}
