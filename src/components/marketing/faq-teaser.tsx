import Link from "next/link";
import { FaqDisclosure } from "@/components/cms/faq-disclosure";
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
            <FaqDisclosure key={item.id} question={item.question}>
              <SimpleMarkdown text={item.answer} />
            </FaqDisclosure>
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
