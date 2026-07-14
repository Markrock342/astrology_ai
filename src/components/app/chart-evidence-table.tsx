"use client";

import type { ChartJson } from "@/types/chart";
import type { MyhoraNatalPlanet } from "@/types/myhora";

type Props = {
  chart: ChartJson;
  /** Prefer transit samrap rows when present. */
  mode?: "natal" | "transit";
  className?: string;
  /** Prefill composer with a follow-up about the clicked planet row. */
  onRowAsk?: (prompt: string) => void;
};

function pickRows(chart: ChartJson, mode: "natal" | "transit"): MyhoraNatalPlanet[] | null {
  if (mode === "transit" && chart.myhora?.transitPlanets?.length) {
    return chart.myhora.transitPlanets;
  }
  if (chart.myhora?.natalPlanets?.length) return chart.myhora.natalPlanets;
  return null;
}

function promptForSamrap(r: MyhoraNatalPlanet, mode: "natal" | "transit"): string {
  const house = r.house ? ` เรือน${r.house}` : "";
  const scope = mode === "transit" ? "ดวงจร" : "พื้นดวง";
  return `ขอคำอธิบายเพิ่มเกี่ยวกับ${r.planet} ในราศี${r.zodiac}${house} จาก${scope}`;
}

function promptForPlanet(
  p: ChartJson["planets"][number],
  mode: "natal" | "transit",
): string {
  const scope = mode === "transit" ? "ดวงจร" : "พื้นดวง";
  return `ขอคำอธิบายเพิ่มเกี่ยวกับ${p.planet} ในราศี${p.siderealSign} จาก${scope}`;
}

/** Evidence table — larger type; source label hidden from users. */
export function ChartEvidenceTable({
  chart,
  mode = "natal",
  className,
  onRowAsk,
}: Props) {
  const samrap = pickRows(chart, mode);
  const lagna = chart.chart?.lagna ?? chart.meta.lagna ?? "—";
  const clickable = Boolean(onRowAsk);

  return (
    <details
      open
      className={
        className ??
        "mt-2 rounded-lg border border-[var(--border)] bg-black/30 text-sm leading-snug text-[var(--muted)]"
      }
    >
      <summary className="cursor-pointer list-none px-3 py-2 text-xs tracking-wide text-[var(--gold)]/90 marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-medium">หลักฐานดวง ▾</span>
          <span className="normal-case text-[var(--muted)]">ลัคนา {lagna}</span>
          {clickable ? (
            <span className="normal-case text-[var(--muted-2)]">
              · แตะแถวเพื่อถามต่อ
            </span>
          ) : null}
        </span>
      </summary>

      <div className="overflow-x-auto border-t border-[var(--border)]">
        {samrap ? (
          <table className="w-full min-w-[520px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-[var(--border)] text-[var(--gold)]/80">
                <th className="px-3 py-2 font-medium">ดาว</th>
                <th className="px-3 py-2 font-medium">ราศี</th>
                <th className="px-3 py-2 font-medium">องศา</th>
                <th className="px-3 py-2 font-medium">เรือน</th>
                <th className="px-3 py-2 font-medium">นวางศ์</th>
                <th className="px-3 py-2 font-medium">ฤกษ์</th>
              </tr>
            </thead>
            <tbody>
              {samrap.map((r) => (
                <tr
                  key={r.planet}
                  className={`border-b border-[var(--border)]/60 last:border-0 ${
                    clickable
                      ? "cursor-pointer transition hover:bg-[var(--primary)]/10"
                      : ""
                  }`}
                  onClick={
                    clickable
                      ? () => onRowAsk?.(promptForSamrap(r, mode))
                      : undefined
                  }
                  title={clickable ? "ถามต่อเกี่ยวกับแถวนี้" : undefined}
                >
                  <td className="px-3 py-2 text-[var(--fg)]">{r.planet}</td>
                  <td className="px-3 py-2">{r.zodiac}</td>
                  <td className="px-3 py-2">
                    {r.degree || r.minute ? `${r.degree || "0"}°${r.minute || "0"}'` : "—"}
                  </td>
                  <td className="px-3 py-2">{r.house || "—"}</td>
                  <td className="px-3 py-2">{r.nawamang || "—"}</td>
                  <td className="px-3 py-2">{r.rerkName || r.rerk || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full min-w-[400px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-[var(--border)] text-[var(--gold)]/80">
                <th className="px-3 py-2 font-medium">ดาว</th>
                <th className="px-3 py-2 font-medium">ราศี</th>
                <th className="px-3 py-2 font-medium">องศา</th>
              </tr>
            </thead>
            <tbody>
              {chart.planets.map((p) => (
                <tr
                  key={p.planet}
                  className={`border-b border-[var(--border)]/60 last:border-0 ${
                    clickable
                      ? "cursor-pointer transition hover:bg-[var(--primary)]/10"
                      : ""
                  }`}
                  onClick={
                    clickable
                      ? () => onRowAsk?.(promptForPlanet(p, mode))
                      : undefined
                  }
                  title={clickable ? "ถามต่อเกี่ยวกับแถวนี้" : undefined}
                >
                  <td className="px-3 py-2 text-[var(--fg)]">{p.planet}</td>
                  <td className="px-3 py-2">{p.siderealSign}</td>
                  <td className="px-3 py-2">{p.degreeText ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </details>
  );
}
