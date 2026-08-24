"use client";

import type { ChartJson } from "@/types/chart";
import type { MyhoraNatalPlanet } from "@/types/myhora";
import { houseFromLagna, normalizeSignName, SIGNS } from "@/lib/chart-theme";
import { formatMyhoraDegreeText } from "@/lib/chart-derivations";
import { collectAstrologyStandards } from "@/lib/astrology-standard-glossary";

type Props = {
  chart: ChartJson;
  /** Prefer transit samrap rows when present. */
  mode?: "natal" | "transit";
  className?: string;
  /** Prefill composer with a follow-up about the clicked planet row. */
  onRowAsk?: (prompt: string) => void;
};

type EvidenceRow = MyhoraNatalPlanet & {
  fallbackDegreeText?: string;
  resolvedHouse?: string;
};

function pickRows(
  chart: ChartJson,
  mode: "natal" | "transit",
): EvidenceRow[] | null {
  const source =
    mode === "transit" && chart.myhora?.transitPlanets?.length
      ? chart.myhora.transitPlanets
      : chart.myhora?.natalPlanets?.length
        ? chart.myhora.natalPlanets
        : null;
  if (!source) return null;

  const lagna = chart.chart?.lagna ?? chart.meta.lagna;
  return source.map((row) => {
    const engineRow = chart.planets.find((planet) =>
      row.planet.includes(planet.planet),
    );
    const sign = normalizeSignName(row.zodiac || engineRow?.siderealSign || "");
    return {
      ...row,
      fallbackDegreeText: engineRow?.degreeText,
      resolvedHouse:
        row.house ||
        (lagna && (SIGNS as readonly string[]).includes(sign)
          ? String(houseFromLagna(lagna, sign))
          : undefined),
    };
  });
}

function promptForSamrap(r: EvidenceRow, mode: "natal" | "transit"): string {
  const house = r.resolvedHouse ? ` เรือน${r.resolvedHouse}` : "";
  const scope = mode === "transit" ? "ดวงจร" : "พื้นดวง";
  return `ขอคำอธิบายเพิ่มเกี่ยวกับ${r.planet} ในราศี${normalizeSignName(r.zodiac)}${house} จาก${scope}`;
}

function promptForPlanet(
  p: ChartJson["planets"][number],
  mode: "natal" | "transit",
): string {
  const scope = mode === "transit" ? "ดวงจร" : "พื้นดวง";
  return `ขอคำอธิบายเพิ่มเกี่ยวกับ${p.planet} ในราศี${normalizeSignName(p.siderealSign)} จาก${scope}`;
}

function degreeText(r: EvidenceRow): string {
  return formatMyhoraDegreeText(r) ?? r.fallbackDegreeText ?? "ยังไม่มีข้อมูลองศา";
}

/** Evidence — card stack on phones, wide table from md up. */
export function ChartEvidenceTable({
  chart,
  mode = "natal",
  className,
  onRowAsk,
}: Props) {
  const samrap = pickRows(chart, mode);
  const lagna = chart.chart?.lagna ?? chart.meta.lagna ?? "—";
  const clickable = Boolean(onRowAsk);
  const standards = mode === "natal" ? collectAstrologyStandards(samrap) : [];

  return (
    <details
      open
      className={
        className ??
        "mt-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-sm leading-snug text-[var(--muted)]"
      }
    >
      <summary className="cursor-pointer list-none px-3 py-2.5 text-xs tracking-wide text-[var(--primary)] marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-medium">หลักฐานดวง ▾</span>
          <span className="normal-case text-[var(--muted)]">ลัคนา {lagna}</span>
          {clickable ? (
            <span className="normal-case text-[var(--muted-2)]">
              · แตะเพื่อถามต่อ
            </span>
          ) : null}
        </span>
      </summary>

      <div className="border-t border-[var(--border)]">
        {samrap ? (
          <>
            {/* Mobile: stacked cards — no horizontal scroll */}
            <ul className="flex flex-col gap-2 p-2 md:hidden">
              {samrap.map((r) => (
                <li key={r.planet}>
                  <button
                    type="button"
                    disabled={!clickable}
                    onClick={() => onRowAsk?.(promptForSamrap(r, mode))}
                    className={`w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3 text-left ${
                      clickable
                        ? "min-h-11 active:bg-[var(--primary)]/10"
                        : "opacity-90"
                    }`}
                  >
                    <p className="text-sm font-medium text-[var(--foreground)]">
                      {r.planet} · {normalizeSignName(r.zodiac)}
                    </p>
                    <p className="mt-1 text-[12px] text-[var(--muted)]">
                      {degreeText(r)}
                      {r.resolvedHouse ? ` · เรือน${r.resolvedHouse}` : ""}
                      {r.nawamang ? ` · นวางศ์ ${r.nawamang}` : ""}
                      {r.rerkName || r.rerk
                        ? ` · ฤกษ์ ${r.rerkName || "—"}${r.rerk ? ` (${r.rerk})` : ""}`
                        : ""}
                    </p>
                    <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 border-t border-[var(--border)]/70 pt-2 text-[11px] text-[var(--muted)]">
                      <div><dt className="text-[var(--muted-2)]">ตรียางค์</dt><dd>{r.triyang || "—"}</dd></div>
                      <div><dt className="text-[var(--muted-2)]">พิษ</dt><dd>{r.poison || "—"}</dd></div>
                      <div><dt className="text-[var(--muted-2)]">บาท / ฤกษ์</dt><dd>{[r.baht, r.rerk2, r.rerkBig].filter(Boolean).join(" · ") || "—"}</dd></div>
                      <div><dt className="text-[var(--muted-2)]">เจ้าเรือน</dt><dd>{r.rerkOwner || "—"}</dd></div>
                      <div className="col-span-2"><dt className="text-[var(--muted-2)]">มาตรฐาน / เกณฑ์</dt><dd className="mt-0.5 text-[var(--foreground)]">{r.rerkStandard || "—"}</dd></div>
                    </dl>
                  </button>
                </li>
              ))}
            </ul>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[1420px] border-collapse text-left text-[12px]">
                <thead>
                  <tr className="border-b border-[var(--border)] text-[var(--primary)]/80">
                    <th className="px-3 py-2 font-medium">ดาว</th>
                    <th className="px-3 py-2 font-medium">ราศี</th>
                    <th className="px-3 py-2 font-medium">องศา</th>
                    <th className="px-3 py-2 font-medium">เรือน</th>
                    <th className="px-3 py-2 font-medium">ตรียางค์</th>
                    <th className="px-3 py-2 font-medium">พิษ</th>
                    <th className="px-3 py-2 font-medium">นวางศ์</th>
                    <th className="px-3 py-2 font-medium">ฤกษ์:นาที</th>
                    <th className="px-3 py-2 font-medium">นักษัตรฤกษ์</th>
                    <th className="px-3 py-2 font-medium">บาท</th>
                    <th className="px-3 py-2 font-medium">ฤกษ์</th>
                    <th className="px-3 py-2 font-medium">ฤกษ์ใหญ่</th>
                    <th className="px-3 py-2 font-medium">เจ้าเรือน</th>
                    <th className="px-3 py-2 font-medium">มาตรฐาน / เกณฑ์</th>
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
                      <td className="px-3 py-2 text-[var(--foreground)]">
                        {r.planet}
                      </td>
                      <td className="px-3 py-2">{normalizeSignName(r.zodiac)}</td>
                      <td className="px-3 py-2">{degreeText(r)}</td>
                      <td className="px-3 py-2">{r.resolvedHouse || "—"}</td>
                      <td className="px-3 py-2">{r.triyang || "—"}</td>
                      <td className="px-3 py-2">{r.poison || "—"}</td>
                      <td className="px-3 py-2">{r.nawamang || "—"}</td>
                      <td className="px-3 py-2">{r.rerk || "—"}</td>
                      <td className="px-3 py-2">{r.rerkName || "—"}</td>
                      <td className="px-3 py-2">{r.baht || "—"}</td>
                      <td className="px-3 py-2">{r.rerk2 || "—"}</td>
                      <td className="px-3 py-2">{r.rerkBig || "—"}</td>
                      <td className="px-3 py-2">{r.rerkOwner || "—"}</td>
                      <td className="max-w-64 px-3 py-2 whitespace-normal text-[var(--foreground)]">{r.rerkStandard || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {standards.length ? (
              <section className="border-t border-[var(--border)] p-3" aria-labelledby="chart-standard-title">
                <div className="max-w-3xl">
                  <h3 id="chart-standard-title" className="text-sm font-semibold text-[var(--foreground)]">
                    มาตรฐานและเกณฑ์ที่พบในดวงนี้
                  </h3>
                  <p className="mt-1 text-[11px] leading-5 text-[var(--muted)]">
                    คำเหล่านี้บอกคุณภาพหรือเงื่อนไขของดาว ไม่ใช่คำตัดสินว่าดวงดีหรือร้ายทั้งดวง
                    ต้องอ่านร่วมกับดาว เรือน และความสัมพันธ์อื่นเสมอ
                  </p>
                </div>
                <dl className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {standards.map((entry) => (
                    <div key={entry.term} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-3">
                      <dt className="flex flex-wrap items-baseline gap-x-2">
                        <span className="font-semibold text-[var(--primary)]">{entry.term}</span>
                        <span className="text-[10px] text-[var(--muted-2)]">{entry.group} · {entry.planets.join(", ")}</span>
                      </dt>
                      <dd className="mt-1 text-[11px] leading-5 text-[var(--muted)]">{entry.meaning}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ) : null}
          </>
        ) : (
          <>
            <ul className="flex flex-col gap-2 p-2 md:hidden">
              {chart.planets.map((p) => (
                <li key={p.planet}>
                  <button
                    type="button"
                    disabled={!clickable}
                    onClick={() => onRowAsk?.(promptForPlanet(p, mode))}
                    className={`w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3 text-left ${
                      clickable
                        ? "min-h-11 active:bg-[var(--primary)]/10"
                        : "opacity-90"
                    }`}
                  >
                    <p className="text-sm font-medium text-[var(--foreground)]">
                      {p.planet} · {normalizeSignName(p.siderealSign)}
                    </p>
                    <p className="mt-1 text-[12px] text-[var(--muted)]">
                      {p.degreeText ?? "—"}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[400px] border-collapse text-left text-[13px]">
                <thead>
                  <tr className="border-b border-[var(--border)] text-[var(--primary)]/80">
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
                      <td className="px-3 py-2 text-[var(--foreground)]">
                        {p.planet}
                      </td>
                      <td className="px-3 py-2">
                        {normalizeSignName(p.siderealSign)}
                      </td>
                      <td className="px-3 py-2">{p.degreeText ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </details>
  );
}
