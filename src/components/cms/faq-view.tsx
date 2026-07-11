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
              <details
                key={item.id}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
              >
                <summary className="cursor-pointer text-sm font-medium text-[var(--foreground)]">
                  {item.question}
                </summary>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[var(--muted)]">
                  {item.answer}
                </p>
              </details>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
