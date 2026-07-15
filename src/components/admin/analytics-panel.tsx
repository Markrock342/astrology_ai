"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AdminPage,
  Button,
  Card,
  PageHeader,
  Select,
  StatCard,
  TableShell,
  TableSkeleton,
  Td,
  Th,
  adminFetch,
} from "./ui";
import { formatThb } from "@/config/ai-pricing";

/**
 * Live usage dashboard.
 *
 * Charts are hand-rolled SVG to the dataviz mark spec: bars ≤24px with a 4px
 * rounded data-end and a 2px surface gap between stacked segments; the cost
 * line is 2px with an 8px end-dot ringed in surface; grid is 1px hairline.
 *
 * Series colors are NOT the raw brand tokens: the palette validator rejected
 * them for the dark surface (gold #c9a24b sits outside the OKLCH lightness
 * band). #b28429 / #0d9b72 pass all six checks — lightness band, chroma floor,
 * CVD separation ΔE 37, contrast — on BOTH surfaces, so they are hardcoded by
 * design, not convenience.
 */
const SERIES = {
  input: { color: "#b28429", label: "Token เข้า (prompt)" },
  output: { color: "#0d9b72", label: "Token ออก (คำตอบ)" },
} as const;

type Day = {
  day: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  calls: number;
  failures: number;
};

type Analytics = {
  generatedAt: string;
  usdToThb: number;
  days: number;
  series: Day[];
  today: Day & { activeUsers: number };
};

const REFRESH_MS = 30_000;

const nf = new Intl.NumberFormat("th-TH");
/** 12.9K-style compact for tick labels only. */
function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return String(n);
}

function dayLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00+07:00`);
  return d.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
}

/** Clean axis max: round up to 1/2/5 × 10^n so ticks are readable numbers. */
function niceMax(v: number): number {
  if (v <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 5, 10]) {
    if (v <= m * pow) return m * pow;
  }
  return 10 * pow;
}

const W = 720;
const H = 220;
const PAD = { top: 14, right: 12, bottom: 26, left: 44 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

/** Stacked daily tokens — two series, gap-separated, hover tooltip per bar. */
function TokenChart({ series }: { series: Day[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(
    Math.max(...series.map((d) => d.inputTokens + d.outputTokens), 1),
  );
  const band = PLOT_W / series.length;
  const barW = Math.min(24, Math.max(6, band * 0.55));

  const y = (v: number) => PAD.top + PLOT_H - (v / max) * PLOT_H;
  const ticks = [0, max / 2, max];

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="กราฟ token ต่อวัน แยกเข้าและออก"
      >
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(t)}
              y2={y(t)}
              stroke="var(--border)"
              strokeWidth={1}
            />
            <text
              x={PAD.left - 6}
              y={y(t) + 3}
              textAnchor="end"
              fontSize={10}
              fill="var(--muted-2)"
            >
              {compact(t)}
            </text>
          </g>
        ))}

        {series.map((d, i) => {
          const x = PAD.left + i * band + (band - barW) / 2;
          const hIn = ((d.inputTokens / max) * PLOT_H) || 0;
          const hOut = ((d.outputTokens / max) * PLOT_H) || 0;
          const baseline = PAD.top + PLOT_H;
          // Stack: input at the baseline, output above, 2px surface gap between.
          const inTop = baseline - hIn;
          const outTop = inTop - 2 - hOut;
          const r = 4;
          return (
            <g
              key={d.day}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              {/* Hit target: the whole band, larger than the marks. */}
              <rect
                x={PAD.left + i * band}
                y={PAD.top}
                width={band}
                height={PLOT_H}
                fill="transparent"
              />
              {hIn > 0 && (
                <rect
                  x={x}
                  y={inTop}
                  width={barW}
                  height={hIn}
                  fill={SERIES.input.color}
                  opacity={hover === null || hover === i ? 1 : 0.45}
                />
              )}
              {hOut > 0.5 && (
                <path
                  d={`M ${x} ${outTop + hOut} L ${x} ${outTop + r} Q ${x} ${outTop} ${x + r} ${outTop} L ${x + barW - r} ${outTop} Q ${x + barW} ${outTop} ${x + barW} ${outTop + r} L ${x + barW} ${outTop + hOut} Z`}
                  fill={SERIES.output.color}
                  opacity={hover === null || hover === i ? 1 : 0.45}
                />
              )}
              {(i === series.length - 1 || i % Math.ceil(series.length / 7) === 0) && (
                <text
                  x={PAD.left + i * band + band / 2}
                  y={H - 8}
                  textAnchor="middle"
                  fontSize={10}
                  fill="var(--muted-2)"
                >
                  {dayLabel(d.day)}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {hover !== null && series[hover] ? (
        <div
          className="pointer-events-none absolute -top-1 rounded-lg border border-[var(--border)] bg-[var(--surface)]/95 px-2.5 py-1.5 text-[11px] shadow-md backdrop-blur"
          style={{
            left: `${((PAD.left + hover * band + band / 2) / W) * 100}%`,
            transform: `translateX(${hover > series.length / 2 ? "-100%" : "0"})`,
          }}
        >
          <p className="font-medium text-[var(--foreground)]">
            {dayLabel(series[hover].day)}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[var(--muted)]">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: SERIES.input.color }}
            />
            เข้า {nf.format(series[hover].inputTokens)}
          </p>
          <p className="flex items-center gap-1.5 text-[var(--muted)]">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: SERIES.output.color }}
            />
            ออก {nf.format(series[hover].outputTokens)}
          </p>
        </div>
      ) : null}

      {/* Legend — two series, so it is always present. */}
      <div className="mt-1 flex items-center gap-4 pl-1">
        {(["input", "output"] as const).map((k) => (
          <span
            key={k}
            className="flex items-center gap-1.5 text-[11px] text-[var(--muted)]"
          >
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ background: SERIES[k].color }}
            />
            {SERIES[k].label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Daily cost — single series line; the title names it, so no legend box. */
function CostChart({ series, usdToThbRate }: { series: Day[]; usdToThbRate: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const thb = series.map((d) => d.costUsd * usdToThbRate);
  const max = niceMax(Math.max(...thb, 0.5));
  const band = PLOT_W / series.length;

  const x = (i: number) => PAD.left + i * band + band / 2;
  const y = (v: number) => PAD.top + PLOT_H - (v / max) * PLOT_H;
  const path = thb
    .map((v, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(v)}`)
    .join(" ");
  const last = series.length - 1;
  const ticks = [0, max / 2, max];

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="กราฟต้นทุน AI ต่อวัน (บาท)"
      >
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(t)}
              y2={y(t)}
              stroke="var(--border)"
              strokeWidth={1}
            />
            <text
              x={PAD.left - 6}
              y={y(t) + 3}
              textAnchor="end"
              fontSize={10}
              fill="var(--muted-2)"
            >
              ฿{compact(Math.round(t))}
            </text>
          </g>
        ))}

        <path
          d={path}
          fill="none"
          stroke={SERIES.input.color}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {series.map((d, i) => (
          <g
            key={d.day}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <rect
              x={PAD.left + i * band}
              y={PAD.top}
              width={band}
              height={PLOT_H}
              fill="transparent"
            />
            {(hover === i || i === last) && (
              <circle
                cx={x(i)}
                cy={y(thb[i])}
                r={4}
                fill={SERIES.input.color}
                stroke="var(--surface)"
                strokeWidth={2}
              />
            )}
            {(i === last || i % Math.ceil(series.length / 7) === 0) && (
              <text
                x={x(i)}
                y={H - 8}
                textAnchor="middle"
                fontSize={10}
                fill="var(--muted-2)"
              >
                {dayLabel(d.day)}
              </text>
            )}
          </g>
        ))}

        {/* Direct label on the endpoint only — today is the number that
            matters. The incoming segment occupies the up-left or down-left
            quadrant depending on slope, so the label takes the empty one. */}
        <text
          x={x(last)}
          y={
            thb[last] >= (thb[last - 1] ?? thb[last])
              ? y(thb[last]) - 10
              : Math.min(y(thb[last]) + 18, PAD.top + PLOT_H - 4)
          }
          textAnchor="end"
          fontSize={11}
          fontWeight={600}
          fill="var(--foreground)"
        >
          {formatThb(series[last].costUsd)}
        </text>
      </svg>

      {hover !== null && series[hover] ? (
        <div
          className="pointer-events-none absolute -top-1 rounded-lg border border-[var(--border)] bg-[var(--surface)]/95 px-2.5 py-1.5 text-[11px] shadow-md backdrop-blur"
          style={{
            left: `${(x(hover) / W) * 100}%`,
            transform: `translateX(${hover > series.length / 2 ? "-100%" : "0"})`,
          }}
        >
          <p className="font-medium text-[var(--foreground)]">
            {dayLabel(series[hover].day)}
          </p>
          <p className="text-[var(--muted)]">
            ต้นทุน {formatThb(series[hover].costUsd)} · {nf.format(series[hover].calls)} ครั้ง
            {series[hover].failures > 0
              ? ` · พลาด ${series[hover].failures}`
              : ""}
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function AnalyticsPanel() {
  const [data, setData] = useState<Analytics | null>(null);
  const [days, setDays] = useState(14);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTable, setShowTable] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const timerRef = useRef<number | null>(null);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      try {
        const next = await adminFetch<Analytics>(
          `/api/admin/analytics?days=${days}`,
        );
        setData(next);
        setLastUpdated(new Date().toLocaleTimeString("th-TH"));
      } catch (e) {
        if (!silent)
          setError(e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [days],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    // "Realtime" = refetch every 30s while the tab is visible. Honest and cheap;
    // the endpoint is one indexed scan.
    timerRef.current = window.setInterval(() => {
      if (!document.hidden) void load(true);
    }, REFRESH_MS);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [load]);

  const t = data?.today;
  const totals = useMemo(() => {
    if (!data) return null;
    return data.series.reduce(
      (a, d) => ({
        tokens: a.tokens + d.inputTokens + d.outputTokens,
        costUsd: a.costUsd + d.costUsd,
        calls: a.calls + d.calls,
      }),
      { tokens: 0, costUsd: 0, calls: 0 },
    );
  }, [data]);

  return (
    <AdminPage>
      <PageHeader
        title="กราฟการใช้งาน"
        description="Token ต้นทุน และปริมาณการใช้งานแบบเรียลไทม์ — อัปเดตอัตโนมัติทุก 30 วินาที"
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="w-40">
          <Select
            value={String(days)}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value="7">7 วันล่าสุด</option>
            <option value="14">14 วันล่าสุด</option>
            <option value="31">31 วันล่าสุด</option>
          </Select>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-[11px] text-[var(--muted-2)]">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[var(--secondary-active)]" />
            อัปเดตล่าสุด {lastUpdated || "—"}
          </span>
          <Button variant="ghost" onClick={() => setShowTable((v) => !v)}>
            {showTable ? "ดูเป็นกราฟ" : "ดูเป็นตาราง"}
          </Button>
        </div>
      </div>

      {error ? (
        <Card>
          <p className="text-sm text-[var(--danger)]">{error}</p>
          <div className="mt-3">
            <Button variant="ghost" onClick={() => void load()}>
              ลองใหม่
            </Button>
          </div>
        </Card>
      ) : loading || !data || !t || !totals ? (
        <TableSkeleton />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="คำถามวันนี้"
              value={nf.format(t.calls)}
              hint={`${nf.format(t.activeUsers)} ผู้ใช้ที่ใช้งาน`}
              tone="gold"
            />
            <StatCard
              label="Token วันนี้"
              value={compact(t.inputTokens + t.outputTokens)}
              hint={`เข้า ${compact(t.inputTokens)} · ออก ${compact(t.outputTokens)}`}
            />
            <StatCard
              label="ต้นทุนวันนี้"
              value={formatThb(t.costUsd)}
              hint={`รวม ${days} วัน ${formatThb(totals.costUsd)}`}
            />
            <StatCard
              label="Error วันนี้"
              value={nf.format(t.failures)}
              tone={t.failures > 0 ? "danger" : "green"}
              hint={t.failures === 0 ? "ระบบนิ่งดี" : "ดูหน้า Error ของระบบ"}
            />
          </div>

          {showTable ? (
            <div className="mt-4">
              <TableShell>
                <thead>
                  <tr>
                    <Th>วัน</Th>
                    <Th className="text-right">Token เข้า</Th>
                    <Th className="text-right">Token ออก</Th>
                    <Th className="text-right">ต้นทุน</Th>
                    <Th className="text-right">คำถาม</Th>
                    <Th className="text-right">พลาด</Th>
                  </tr>
                </thead>
                <tbody>
                  {[...data.series].reverse().map((d) => (
                    <tr key={d.day}>
                      <Td>{dayLabel(d.day)}</Td>
                      <Td className="text-right tabular-nums">
                        {nf.format(d.inputTokens)}
                      </Td>
                      <Td className="text-right tabular-nums">
                        {nf.format(d.outputTokens)}
                      </Td>
                      <Td className="text-right tabular-nums">
                        {formatThb(d.costUsd)}
                      </Td>
                      <Td className="text-right tabular-nums">
                        {nf.format(d.calls)}
                      </Td>
                      <Td
                        className={`text-right tabular-nums ${d.failures > 0 ? "text-[var(--danger)]" : ""}`}
                      >
                        {nf.format(d.failures)}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </TableShell>
            </div>
          ) : (
            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              <Card>
                <h2 className="text-sm font-semibold">Token ต่อวัน</h2>
                <p className="mb-2 text-[11px] text-[var(--muted-2)]">
                  รวม {days} วัน: {nf.format(totals.tokens)} tokens ·{" "}
                  {nf.format(totals.calls)} ครั้ง
                </p>
                <TokenChart series={data.series} />
              </Card>
              <Card>
                <h2 className="text-sm font-semibold">ต้นทุน AI ต่อวัน (บาท)</h2>
                <p className="mb-2 text-[11px] text-[var(--muted-2)]">
                  ราคา ณ ตอนเรียกจริง · $1 = {data.usdToThb}฿ · เดือนนี้โดยประมาณ{" "}
                  {formatThb(totals.costUsd)}
                </p>
                <CostChart series={data.series} usdToThbRate={data.usdToThb} />
              </Card>
            </div>
          )}
        </>
      )}
    </AdminPage>
  );
}
