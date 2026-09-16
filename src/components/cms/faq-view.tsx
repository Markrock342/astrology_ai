import { FaqDisclosure } from "@/components/cms/faq-disclosure";
import { SimpleMarkdown } from "@/components/cms/simple-markdown";

type FaqViewItem = {
  id: string;
  question: string;
  answer: string;
  category: string;
};

const CATEGORY_LABEL: Record<string, string> = {
  general: "ทั่วไป",
  credits: "เครดิต & การใช้งาน",
  pro: "แพ็กเกจ Pro",
  payment: "การชำระเงิน",
  accuracy: "ความแม่นยำ",
};

export function FaqView({ items }: { items: FaqViewItem[] }) {
  const grouped = items.reduce<Record<string, FaqViewItem[]>>((acc, item) => {
    const key = item.category || "general";
    acc[key] = acc[key] ?? [];
    acc[key].push(item);
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      {Object.entries(grouped).map(([cat, rows]) => (
        <section key={cat}>
          <h2 className="mb-3 text-sm font-semibold text-[var(--primary)]">
            {CATEGORY_LABEL[cat] ?? cat}
          </h2>
          <div className="space-y-3">
            {rows.map((item) => (
              <FaqDisclosure key={item.id} question={item.question} variant="card">
                <SimpleMarkdown text={item.answer} />
              </FaqDisclosure>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
