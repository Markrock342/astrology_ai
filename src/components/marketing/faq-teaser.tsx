import Link from "next/link";
import { SimpleMarkdown } from "@/components/cms/simple-markdown";
import { SectionHeader } from "@/components/marketing/section-header";

export type FaqTeaserItem = {
  id: string;
  question: string;
  answer: string;
};

export function FaqTeaser({ items }: { items: FaqTeaserItem[] }) {
  const shown = items.slice(0, 6);
  if (shown.length === 0) return null;

  return (
    <section className="border-t border-[var(--border)] px-6 py-20">
      <div className="mx-auto max-w-3xl">
        <SectionHeader
          title="คำถามที่พบบ่อย"
          subtitle="คำตอบสั้น ๆ ก่อนเริ่มใช้งาน"
          align="left"
        />

        <div className="mt-10 border-b border-[var(--border)]">
          {shown.map((item) => (
            <details key={item.id} className="group border-t border-[var(--border)]">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-4 py-4 text-sm font-medium text-[var(--foreground)] marker:content-none sm:text-base [&::-webkit-details-marker]:hidden">
                <span>{item.question}</span>
                <span
                  aria-hidden
                  className="mt-0.5 shrink-0 text-[var(--primary)] transition-transform duration-200 group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="max-w-[65ch] pb-5 text-sm leading-relaxed text-[var(--muted)]">
                <SimpleMarkdown text={item.answer} />
              </p>
            </details>
          ))}
        </div>

        <p className="mt-8">
          <Link
            href="/help"
            className="text-sm font-medium text-[var(--primary)] underline-offset-4 hover:underline"
          >
            ดู FAQ ทั้งหมด →
          </Link>
        </p>
      </div>
    </section>
  );
}
