"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AdminPage,
  InfoBox,
  Badge,
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
import { GeminiBalanceCard } from "./gemini-balance-card";
import { CreditReportCard } from "./credit-report-card";
import { ProLapseRepairCard } from "./pro-lapse-repair-card";
import { formatThb, usdToThb } from "@/config/ai-pricing";
import type { Spread, UsageStats } from "@/lib/usage-stats";

type Row = {
  userId: string;
  email: string;
  name: string | null;
  plan: "FREE" | "PRO";
  packageName: string | null;
  proGifted: boolean;
  revenueThb: number;
  readings: number;
  aiCalls: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  costPerReadingUsd: number | null;
  hasUnpricedModel: boolean;
};

type Summary = {
  periodLabel: string;
  usdToThb: number;
  totals: {
    users: number;
    payingUsers: number;
    readings: number;
    aiCalls: number;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
    revenueThb: number;
    unprofitableUsers: number;
    freeCostUsd: number;
  };
  pro: { priceThb: number; budgetUsd: number } | null;
  usage: UsageStats;
  rows: Row[];
};

const num = (n: number) => n.toLocaleString("th-TH");
const baht = (thb: number) =>
  `฿${thb.toLocaleString("th-TH", { maximumFractionDigits: 0 })}`;

/** Margin as a percentage of revenue. Null when nobody is paying yet. */
function marginPct(revenueThb: number, costUsd: number): number | null {
  if (revenueThb <= 0) return null;
  return ((revenueThb - usdToThb(costUsd)) / revenueThb) * 100;
}

export function CostPanel() {
  const [data, setData] = useState<Summary | null>(null);
  const [months, setMonths] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      setData(await adminFetch<Summary>(`/api/admin/costs?months=${months}`));
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "โหลดข้อมูลต้นทุนไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [months]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const t = data?.totals;
  const profitThb = t ? t.revenueThb - usdToThb(t.costUsd) : 0;
  const overallMargin = t ? marginPct(t.revenueThb, t.costUsd) : null;
  const costPerReadingUsd =
    t && t.readings > 0 ? t.costUsd / t.readings : null;

  return (
    <AdminPage>
      <PageHeader
        title="กำไรขาดทุน"
        description="เงินที่ได้รับจริง เทียบกับค่า AI ที่จ่ายไป — พร้อมตัวเลขการใช้งานไว้ตั้งราคาและดูกำลังเซิร์ฟเวอร์"
      />

      <GeminiBalanceCard />
      <CreditReportCard />
      <ProLapseRepairCard />

      <div className="mb-4 flex items-center gap-2">
        <Select
          value={String(months)}
          onChange={(e) => setMonths(Number(e.target.value))}
          className="max-w-48"
        >
          <option value="0">เดือนนี้</option>
          <option value="1">2 เดือนล่าสุด</option>
          <option value="2">3 เดือนล่าสุด</option>
          <option value="5">6 เดือนล่าสุด</option>
        </Select>
      </div>

      {error ? (
        <Card>
          <p className="text-sm text-[var(--danger)]">{error}</p>
        </Card>
      ) : null}

      <InfoBox>
        <p className="font-medium text-[var(--foreground)]">อ่านหน้านี้ยังไง</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-4">
          <li>
            <b>รายได้</b> = เงินโอนที่แอดมินอนุมัติแล้วในช่วงที่เลือก · Pro ที่แอดมินให้ฟรีหรือโปรแจกฟรี
            ไม่นับเป็นรายได้
          </li>
          <li>
            <b>ต้นทุน</b> = ค่า AI (Gemini) ที่เราจ่ายจริงทุกคำถาม ของทุกคน รวมคนที่ใช้ฟรี
          </li>
          <li>
            <b>กำไร</b> = รายได้ − ต้นทุน · ช่วงแจกใช้ฟรีจะติดลบเป็นปกติ ก้อนนั้นคือ “ต้นทุนผู้ใช้ฟรี”
          </li>
          <li>ยังไม่รวมค่าเซิร์ฟเวอร์ ค่าโดเมน และค่าอีเมล</li>
        </ul>
      </InfoBox>

      {loading ? (
        <TableSkeleton />
      ) : !data ? null : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="รายได้"
              value={baht(t!.revenueThb)}
              hint={`${num(t!.payingUsers)} ผู้ใช้ที่จ่ายเงิน`}
              tone="gold"
            />
            <StatCard
              label="ต้นทุน AI"
              value={formatThb(t!.costUsd)}
              hint={`ในนี้เป็นของผู้ใช้ฟรี ${formatThb(t!.freeCostUsd)}`}
            />
            <StatCard
              label={profitThb >= 0 ? "กำไร" : "ขาดทุน"}
              value={baht(Math.abs(profitThb))}
              hint={
                overallMargin != null
                  ? `margin ${overallMargin.toFixed(1)}%`
                  : "ยังไม่มีรายได้"
              }
              tone={profitThb >= 0 ? "green" : "danger"}
            />
            <StatCard
              label="ต้นทุนต่อ 1 คำถาม"
              value={
                costPerReadingUsd != null ? formatThb(costPerReadingUsd) : "—"
              }
              hint={`จาก ${num(t!.readings)} คำถามที่ตอบไป`}
              tone={
                // Against the Pro plan's own price: 199฿ for 100 readings means
                // anything over ~1.99฿ each is losing money on that package.
                costPerReadingUsd != null && usdToThb(costPerReadingUsd) > 1.99
                  ? "danger"
                  : "default"
              }
            />
          </div>

          {t!.unprofitableUsers > 0 ? (
            <Card className="mt-4 border-[var(--danger)]/40">
              <p className="text-sm text-[var(--danger)]">
                ⚠️ มี {num(t!.unprofitableUsers)} คนที่จ่ายเงินแล้ว แต่{" "}
                <strong>ใช้ค่า AI มากกว่าเงินที่จ่าย</strong> — ดูแถวสีแดงด้านล่าง
              </p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Output token แพงกว่า input 6 เท่า ($9.00 vs $1.50 ต่อ 1M) — คนที่ใช้โหมด
                “ละเอียด” ในเธรดยาว ๆ คือกลุ่มที่กินต้นทุนมากที่สุด
              </p>
            </Card>
          ) : null}

          <UsageSection usage={data.usage} totals={t!} pro={data.pro} />

          <h2 className="mb-2 mt-6 text-sm font-semibold text-[var(--foreground)]">รายคน</h2>
          <div>
            <TableShell>
              <thead>
                <tr>
                  <Th>ผู้ใช้</Th>
                  <Th>แพ็กเกจ</Th>
                  <Th className="text-right">คำถาม</Th>
                  <Th className="text-right">ค่า AI</Th>
                  <Th className="text-right">ต่อคำถาม</Th>
                  <Th className="text-right">รายได้</Th>
                  <Th className="text-right">กำไร</Th>
                </tr>
              </thead>
              <tbody>
                {data.rows.length === 0 ? (
                  <tr>
                    <Td colSpan={7}>
                      <p className="py-6 text-center text-sm text-[var(--muted)]">
                        ยังไม่มีการใช้งาน AI ในช่วงนี้
                      </p>
                    </Td>
                  </tr>
                ) : (
                  data.rows.map((r) => {
                    const costThb = usdToThb(r.costUsd);
                    const profit = r.revenueThb - costThb;
                    const losing = r.revenueThb > 0 && costThb > r.revenueThb;
                    return (
                      <tr
                        key={r.userId}
                        className={losing ? "bg-[var(--danger)]/5" : undefined}
                      >
                        <Td>
                          <Link
                            href={`/admin/users/${r.userId}`}
                            className="text-[var(--primary)] hover:underline"
                          >
                            {r.name ?? r.email.split("@")[0]}
                          </Link>
                          <p className="text-[10px] text-[var(--muted-2)]">
                            {r.email}
                          </p>
                        </Td>
                        <Td>
                          <Badge tone={r.plan === "PRO" ? "gold" : "muted"}>
                            {r.packageName ?? r.plan}
                          </Badge>
                          {r.proGifted ? (
                            <p className="mt-0.5 text-[10px] text-[var(--muted-2)]">แอดมินให้ ไม่ได้จ่าย</p>
                          ) : null}
                        </Td>
                        <Td className="text-right tabular-nums">
                          {num(r.readings)}
                          {r.aiCalls > r.readings ? (
                            <span
                              className="ml-1 text-[10px] text-[var(--muted-2)]"
                              title="รวมการเรียกโมเดลเสริม (สรุป/คำถามต่อ) ที่ไม่คิดเครดิต"
                            >
                              +{num(r.aiCalls - r.readings)}
                            </span>
                          ) : null}
                        </Td>
                        <Td className="text-right tabular-nums">
                          <span title={`token เข้า ${num(r.inputTokens)} / ออก ${num(r.outputTokens)}`}>
                            {formatThb(r.costUsd)}
                          </span>
                          {r.hasUnpricedModel ? (
                            <span
                              className="ml-1 text-[var(--muted-2)]"
                              title="มีโมเดลที่ไม่มีราคาในระบบ — ต้นทุนเป็นการประมาณ"
                            >
                              ~
                            </span>
                          ) : null}
                        </Td>
                        <Td className="text-right tabular-nums">
                          {r.costPerReadingUsd != null
                            ? formatThb(r.costPerReadingUsd)
                            : "—"}
                        </Td>
                        <Td className="text-right tabular-nums text-[var(--muted)]">
                          {r.revenueThb > 0 ? baht(r.revenueThb) : "—"}
                        </Td>
                        <Td
                          className={`text-right tabular-nums font-medium ${
                            losing
                              ? "text-[var(--danger)]"
                              : r.revenueThb > 0
                                ? "text-[var(--secondary-active)]"
                                : "text-[var(--muted)]"
                          }`}
                        >
                          {profit >= 0 ? "+" : "−"}
                          {baht(Math.abs(profit))}
                        </Td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </TableShell>
          </div>

          <p className="mt-3 text-[11px] leading-relaxed text-[var(--muted-2)]">
            ค่า AI คิดจากจำนวน token ที่บันทึกไว้จริงของทุกคำถาม × ราคาโมเดล (อัตรา $1 ={" "}
            {data.usdToThb}฿) รวมค่าสรุปและคำถามแนะนำที่ไม่ได้หักโควตาผู้ใช้ · รายได้คือยอดโอนที่อนุมัติในช่วงนี้
            (คนที่โอนเดือนก่อนแต่ใช้เดือนนี้ จะเห็นรายได้ 0 ในเดือนนี้)
          </p>
        </>
      )}
    </AdminPage>
  );
}

const one = (n: number) => n.toLocaleString("th-TH", { maximumFractionDigits: 1 });
const secs = (ms: number | null) => (ms == null ? "—" : `${(ms / 1000).toFixed(1)} วิ`);

function SpreadLine({ s, unit }: { s: Spread; unit: string }) {
  return (
    <p className="mt-1 text-[10px] leading-relaxed text-[var(--muted-2)]">
      ครึ่งหนึ่งไม่เกิน {num(s.median)} {unit} · 10% ที่ใช้หนักเกิน {num(s.p90)} {unit} · สูงสุด{" "}
      {num(s.max)} {unit}
    </p>
  );
}

/** How people use it (for pricing) and how hard it runs (for the server). */
function UsageSection({
  usage: u,
  totals,
  pro,
}: {
  usage: UsageStats;
  totals: Summary["totals"];
  pro: Summary["pro"];
}) {
  const costPerUserUsd = u.activeUsers ? totals.costUsd / u.activeUsers : 0;
  const budgetPct = pro && pro.budgetUsd > 0 ? (costPerUserUsd / pro.budgetUsd) * 100 : null;
  const peakHour = Math.max(...u.load.byHourOfDay, 0);
  const costPerReadingThb = totals.readings ? usdToThb(totals.costUsd / totals.readings) : null;

  return (
    <>
      <h2 className="mb-2 mt-6 text-sm font-semibold text-[var(--foreground)]">
        คนใช้กันแค่ไหน <span className="font-normal text-[var(--muted)]">— ไว้ตั้งราคาแพ็กเกจ</span>
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="คนที่ใช้งาน" value={num(u.activeUsers)} hint="ถามอย่างน้อย 1 คำถามในช่วงนี้" />
        <Card className="!p-4">
          <p className="text-[11px] text-[var(--muted)]">ถามต่อคน</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{one(u.perUser.avg)} คำถาม</p>
          <SpreadLine s={u.perUser} unit="คำถาม" />
        </Card>
        <Card className="!p-4">
          <p className="text-[11px] text-[var(--muted)]">ค่า AI ต่อคน (เฉลี่ย)</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{formatThb(costPerUserUsd)}</p>
          <p className="mt-1 text-[10px] leading-relaxed text-[var(--muted-2)]">
            {budgetPct != null
              ? `= ${one(budgetPct)}% ของงบ AI ในแพ็กเกจ Pro (${formatThb(pro!.budgetUsd)} ต่อ ${pro!.priceThb}฿)`
              : "ยังไม่ได้ตั้งงบแพ็กเกจ Pro"}
          </p>
        </Card>
        <Card className="!p-4">
          <p className="text-[11px] text-[var(--muted)]">ถามต่อการเข้าใช้ 1 รอบ</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{one(u.perSession.avg)} คำถาม</p>
          <p className="mt-1 text-[10px] leading-relaxed text-[var(--muted-2)]">
            1 รอบ = ถามต่อเนื่องโดยไม่เว้นเกิน 30 นาที · คนละ {one(u.sessionsPerUser)} รอบในช่วงนี้ ·
            สูงสุด {num(u.perSession.max)} คำถามในรอบเดียว
          </p>
        </Card>
      </div>
      {costPerReadingThb != null && pro ? (
        <p className="mt-2 text-[11px] leading-relaxed text-[var(--muted)]">
          ตัวช่วยคิดราคา: 1 คำถามเฉลี่ย {costPerReadingThb.toFixed(2)}฿ → เงิน {pro.priceThb}฿ ของ Pro 1 คน
          จ่ายค่า AI ได้ประมาณ {num(Math.floor(pro.priceThb / costPerReadingThb))} คำถาม หรือเท่ากับคนใช้แบบเฉลี่ยตอนนี้{" "}
          {costPerUserUsd > 0 ? one(pro.priceThb / usdToThb(costPerUserUsd)) : "—"} คน
        </p>
      ) : null}

      <h2 className="mb-2 mt-6 text-sm font-semibold text-[var(--foreground)]">
        ระบบหนักแค่ไหน <span className="font-normal text-[var(--muted)]">— ไว้ดูกำลังเซิร์ฟเวอร์</span>
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="ตอบพร้อมกันสูงสุด"
          value={`${num(u.load.peakConcurrent)} คำตอบ`}
          hint={u.load.peakConcurrentAt ? `เมื่อ ${u.load.peakConcurrentAt} น.` : "ยังไม่มีข้อมูล"}
        />
        <StatCard
          label="ชั่วโมงที่คนถามมากที่สุด"
          value={u.load.busiestHour ? `${num(u.load.busiestHour.calls)} คำถาม` : "—"}
          hint={u.load.busiestHour ? `ช่วง ${u.load.busiestHour.at} น.` : undefined}
        />
        <StatCard
          label="เริ่มเห็นคำตอบภายใน"
          value={secs(u.load.firstTokenMs.p50)}
          hint={`ครึ่งหนึ่งของคำถาม · 95% ภายใน ${secs(u.load.firstTokenMs.p95)}`}
        />
        <StatCard
          label="ตอบจบภายใน"
          value={secs(u.load.latencyMs.p50)}
          hint={`ครึ่งหนึ่งของคำถาม · 95% ภายใน ${secs(u.load.latencyMs.p95)}`}
        />
      </div>

      <Card className="mt-3 !p-4">
        <p className="text-[11px] text-[var(--muted)]">
          คำถามเฉลี่ยต่อวัน แยกตามชั่วโมง (เวลาไทย) — แท่งสูงคือช่วงที่เซิร์ฟเวอร์ทำงานหนัก
        </p>
        <div className="mt-3 flex h-24 items-end gap-[3px]" role="img" aria-label="คำถามเฉลี่ยต่อชั่วโมง">
          {u.load.byHourOfDay.map((v, h) => (
            <div
              key={h}
              title={`${String(h).padStart(2, "0")}:00 — เฉลี่ย ${one(v)} คำถาม/วัน`}
              className="flex-1 rounded-t bg-[var(--primary)]/70"
              style={{ height: `${peakHour > 0 ? Math.max(2, (v / peakHour) * 100) : 2}%` }}
            />
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[9px] tabular-nums text-[var(--muted-2)]">
          <span>00</span>
          <span>06</span>
          <span>12</span>
          <span>18</span>
          <span>23</span>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-[var(--muted)]">
          วิธีอ่าน: เซิร์ฟเวอร์ของเราทำงานหนักตามจำนวนคำตอบที่กำลังเขียนพร้อมกัน ถ้า “ตอบพร้อมกันสูงสุด”
          โตขึ้นเรื่อย ๆ และ “เริ่มเห็นคำตอบภายใน” ช้าลงตามไปด้วย แปลว่าเริ่มเต็มกำลัง ถ้าตัวเลขเร็วคงที่
          แม้คนเยอะขึ้น แปลว่ายังรับไหว
        </p>
      </Card>
    </>
  );
}
