"use client";

import type { ChartJson } from "@/types/chart";
import type { MyhoraNatalPlanet } from "@/types/myhora";

type Props = {
  chart: ChartJson;
  /** Prefer transit samrap rows when present. */
  mode?: "natal" | "transit";
  className?: string;
};

function pickRows(chart: ChartJson, mode: "natal" | "transit"): MyhoraNatalPlanet[] | null {
  if (mode === "transit" && chart.myhora?.transitPlanets?.length) {
    return chart.myhora.transitPlanets;
  }
  if (chart.myhora?.natalPlanets?.length) return chart.myhora.natalPlanets;
  return null;
}

/** Evidence table — collapsed by default so it does not bury the composer. */
export function ChartEvidenceTable({ chart, mode = "natal", className }: Props) {
  const samrap = pickRows(chart, mode);
  const lagna = chart.chart?.lagna ?? chart.meta.lagna ?? "—";
  const source = chart.meta.calculationSource ?? "formula-pipeline";

  return (
    <details
      className={
        className ??
        "mt-1 rounded-md border border-[var(--border)] bg-black/30 text-[11px] leading-snug text-[var(--muted)]"
      }
    >
      <summary className="cursor-pointer list-none px-2.5 py-1.5 text-[10px] uppercase tracking-wide text-[var(--gold)]/80 marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>หลักฐานดวง ▸</span>
          <span className="normal-case text-[var(--muted)]">ลัคนา {lagna}</span>
          <span className="normal-case opacity-70">{source}</span>
        </span>
      </summary>

      <div className="overflow-x-auto border-t border-[var(--border)]">
        {samrap ? (
          <table className="w-full min-w-[420px] border-collapse text-left">
            <thead>
              <tr className="border-b border-[var(--border)] text-[var(--gold)]/70">
                <th className="px-2 py-1 font-medium">ดาว</th>
                <th className="px-2 py-1 font-medium">ราศี</th>
                <th className="px-2 py-1 font-medium">องศา</th>
                <th className="px-2 py-1 font-medium">เรือน</th>
                <th className="px-2 py-1 font-medium">นวางศ์</th>
                <th className="px-2 py-1 font-medium">ฤกษ์</th>
              </tr>
            </thead>
            <tbody>
              {samrap.map((r) => (
                <tr key={r.planet} className="border-b border-[var(--border)]/60 last:border-0">
                  <td className="px-2 py-1 text-[var(--fg)]">{r.planet}</td>
                  <td className="px-2 py-1">{r.zodiac}</td>
                  <td className="px-2 py-1">
                    {r.degree || r.minute ? `${r.degree || "0"}°${r.minute || "0"}'` : "—"}
                  </td>
                  <td className="px-2 py-1">{r.house || "—"}</td>
                  <td className="px-2 py-1">{r.nawamang || "—"}</td>
                  <td className="px-2 py-1">{r.rerkName || r.rerk || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full min-w-[320px] border-collapse text-left">
            <thead>
              <tr className="border-b border-[var(--border)] text-[var(--gold)]/70">
                <th className="px-2 py-1 font-medium">ดาว</th>
                <th className="px-2 py-1 font-medium">ราศี</th>
                <th className="px-2 py-1 font-medium">องศา</th>
              </tr>
            </thead>
            <tbody>
              {chart.planets.map((p) => (
                <tr key={p.planet} className="border-b border-[var(--border)]/60 last:border-0">
                  <td className="px-2 py-1 text-[var(--fg)]">{p.planet}</td>
                  <td className="px-2 py-1">{p.siderealSign}</td>
                  <td className="px-2 py-1">{p.degreeText ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </details>
  );
}
