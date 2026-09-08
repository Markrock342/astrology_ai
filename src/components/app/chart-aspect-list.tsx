import { ASPECT_KINDS, computeChartAspects, type ChartAspect } from "@/lib/chart-aspects";
import type { PlanetSignRow } from "@/types/chart";

const KIND_HINT: Record<(typeof ASPECT_KINDS)[number], string> = {
  กุม: "ราศีเดียวกัน ภพ 1 มุม 0° (ห่างไม่เกิน 30°)",
  เล็ง: "ราศีตรงข้าม เรือน 7 มุม 180°",
  ตรีโกณ: "เรือน 5 หรือ 9 มุม 120°",
  จตุโกณ: "เรือน 4 หรือ 10 มุม 90°",
};

export function ChartAspectList({
  planets,
  lagna,
  lagnaDegreeInSign,
}: {
  planets: PlanetSignRow[];
  lagna?: string | null;
  lagnaDegreeInSign?: number | null;
}) {
  const aspects = computeChartAspects(planets, lagna, lagnaDegreeInSign);
  const grouped = ASPECT_KINDS.map((kind) => ({
    kind,
    rows: aspects.filter((item) => item.kind === kind),
  }));

  return (
    <section className="border-t border-[var(--border)] p-3" aria-labelledby="chart-aspect-title">
      <div className="max-w-3xl">
        <h3 id="chart-aspect-title" className="text-sm font-semibold text-[var(--foreground)]">
          มุมสัมพันธ์จากองศาจริง
        </h3>
        <p className="mt-1 text-[11px] leading-5 text-[var(--muted)]">
          คำนวณจากราศีและองศาของดาวในดวงนี้ ไม่ได้เดาจากชื่อราศีอย่างเดียว
        </p>
      </div>
      <dl className="mt-3 grid gap-2 sm:grid-cols-2">
        {grouped.map(({ kind, rows }) => (
          <div key={kind} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-3">
            <dt className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-semibold text-[var(--primary)]">{kind}</span>
              <span className="text-[10px] text-[var(--muted-2)]">{KIND_HINT[kind]}</span>
            </dt>
            <dd className="mt-1 text-[11px] leading-5 text-[var(--muted)]">
              {rows.length ? (
                <ul className="flex flex-col gap-1">
                  {rows.map((item) => (
                    <li key={`${item.kind}-${item.a.name}-${item.b.name}`}>
                      {formatAspectLine(item)}
                    </li>
                  ))}
                </ul>
              ) : (
                "ไม่พบในดวงนี้"
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function formatAspectLine(item: ChartAspect): string {
  return `${item.a.name}–${item.b.name} · เรือน ${item.houseFromA} · ห่าง ${item.degreeSep.toFixed(1)}°`;
}
