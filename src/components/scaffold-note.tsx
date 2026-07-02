/**
 * Temporary scaffold placeholder used on skeleton pages during Milestone 1.
 * Replace each page body with the real UI (Frontend task). Delete this
 * component once no page imports it.
 */
export function ScaffoldNote({
  title,
  owner,
  children,
}: {
  title: string;
  owner: "Frontend" | "Backend" | "Both";
  children?: React.ReactNode;
}) {
  const color =
    owner === "Frontend"
      ? "text-sky-300"
      : owner === "Backend"
        ? "text-emerald-300"
        : "text-[var(--accent)]";
  return (
    <section className="mx-auto max-w-3xl px-6 py-10">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8">
        <p className={`text-xs font-medium uppercase tracking-widest ${color}`}>
          {owner} · scaffold
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
          {title}
        </h1>
        <div className="mt-4 text-sm leading-relaxed text-[var(--muted)]">
          {children ?? "หน้านี้เป็นโครงเปล่า รอการพัฒนาใน Milestone ถัดไป"}
        </div>
      </div>
    </section>
  );
}
