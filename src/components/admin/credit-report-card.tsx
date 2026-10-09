"use client";

import { useEffect, useState } from "react";
import { ChartColumn } from "lucide-react";
import { Card, IconTile, adminFetch } from "./ui";
import { formatBaht } from "@/config/ai-pricing";

type Bucket = { calls: number; inputTokens: number; outputTokens: number; cachedTokens: number; costUsd: number };
type Report = {
  since: string;
  sinceTracked: boolean;
  topUpThb: number | null;
  topUpUsd: number | null;
  topUpUnits: number | null;
  spentThb: number;
  remainingThb: number | null;
  answers: Bucket;
  background: Bucket;
  failedCalls: number;
  byModel: Array<Bucket & { modelId: string }>;
  perAnswer: { inputTokens: number; outputTokens: number; costThb: number; allInCostThb: number; allInUnits: number } | null;
  answersLeft: number | null;
  daily: Array<{ day: string; answers: number; costThb: number }>;
};

const USD_TO_THB = 36;
const n = (v: number) => v.toLocaleString("th-TH");
const thb = (usd: number) => formatBaht(usd * USD_TO_THB);
const dateTh = (iso: string) =>
  new Date(iso).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
      <p className="text-[11px] text-[var(--muted)]">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-[var(--foreground)]">{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-[var(--muted-2)]">{hint}</p> : null}
    </div>
  );
}

const th = "px-2 py-1.5 text-left text-[11px] font-semibold text-[var(--muted)]";
const td = "px-2 py-1.5 text-[12px] tabular-nums text-[var(--foreground)]";

/**
 * "เติม 400 บาท ได้กี่ credit, เรียก AI กี่ครั้ง ครั้งละเท่าไร, ถามหนึ่งครั้งใช้
 * เฉลี่ยเท่าไร" — the round since the tracked top-up, from our own call log.
 */
export function CreditReportCard() {
  const [data, setData] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminFetch<Report>("/api/admin/credit-report")
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "โหลดไม่ได้"));
  }, []);

  return (
    <Card className="mb-4">
      <h2 className="flex items-center gap-2.5 text-sm font-semibold text-[var(--foreground)]">
        <IconTile icon={ChartColumn} tone="violet" size="sm" />รายงานการใช้เครดิต AI</h2>
      <p className="mt-1 max-w-2xl text-xs leading-relaxed text-[var(--muted)]">
        นับจาก log การเรียก AI ทุกครั้งของระบบเรา
        {data ? (data.sinceTracked ? ` ตั้งแต่เติมเงินรอบนี้ (${dateTh(data.since)})` : ` ตั้งแต่ต้นเดือน (ยังไม่ได้ใส่ยอดเติมในการ์ดด้านบน)`) : ""}
        {" "}— บิลของ Google บอกแค่ยอดรวมรายวัน ตัวเลขนี้ใช้ราคาในตารางของระบบ จึงอาจต่างจากบิลจริงเล็กน้อย
      </p>
      {error ? <p className="mt-3 text-xs text-[var(--danger)]">{error}</p> : null}
      {!data && !error ? <p className="mt-3 text-xs text-[var(--muted)]">กำลังโหลด…</p> : null}
      {data ? (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
            <Stat
              label="เติมมา"
              value={data.topUpThb != null ? formatBaht(data.topUpThb) : "—"}
              hint={data.topUpUsd != null && data.topUpUnits != null ? `≈ $${data.topUpUsd.toFixed(2)} · ${n(data.topUpUnits)} หน่วย usage` : "ใส่ยอดเติมในการ์ดด้านบน"}
            />
            <Stat label="ใช้ไปแล้ว" value={formatBaht(data.spentThb)} hint={`คำตอบ ${n(data.answers.calls)} ครั้ง + งานเบื้องหลัง ${n(data.background.calls)} ครั้ง`} />
            <Stat label="เหลือประมาณ" value={data.remainingThb != null ? formatBaht(data.remainingThb) : "—"} />
            <Stat label="ตอบได้อีกประมาณ" value={data.answersLeft != null ? `${n(data.answersLeft)} คำถาม` : "—"} hint="ที่ต้นทุนเฉลี่ยรวมงานเบื้องหลัง" />
          </div>

          {data.perAnswer ? (
            <div className="mt-4 rounded-xl border border-[var(--primary)]/35 bg-[var(--primary)]/8 p-3 text-[13px] leading-6 text-[var(--foreground)]">
              <b>ถาม 1 ครั้งใช้เฉลี่ย:</b> ส่งเข้า {n(data.perAnswer.inputTokens)} token · ได้กลับ {n(data.perAnswer.outputTokens)} token ·{" "}
              <b>{formatBaht(data.perAnswer.costThb)}</b> (เฉพาะคำตอบ) ·{" "}
              <b>{formatBaht(data.perAnswer.allInCostThb)}</b> รวมงานเบื้องหลัง ({n(data.perAnswer.allInUnits)} หน่วย usage)
            </div>
          ) : null}

          <h3 className="mb-1 mt-4 text-xs font-semibold text-[var(--foreground)]">เรียก AI ไปกี่ครั้ง ครั้งละเท่าไร</h3>
          <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
            <table className="min-w-full">
              <thead className="bg-[var(--surface-2)]">
                <tr>
                  <th className={th}>ประเภท</th>
                  <th className={`${th} text-right`}>ครั้ง</th>
                  <th className={`${th} text-right`}>token เข้า (รวม)</th>
                  <th className={`${th} text-right`}>token ออก (รวม)</th>
                  <th className={`${th} text-right`}>เฉลี่ยต่อครั้ง (เข้า/ออก)</th>
                  <th className={`${th} text-right`}>ต้นทุน</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {(
                  [
                    ["คำตอบให้ผู้ใช้", data.answers],
                    ["งานเบื้องหลัง (คำถามแนะนำ ความจำ สรุปแชท แก้คำผิด)", data.background],
                  ] as const
                ).map(([label, b]) => (
                  <tr key={label}>
                    <td className={td}>{label}</td>
                    <td className={`${td} text-right`}>{n(b.calls)}</td>
                    <td className={`${td} text-right`}>{n(b.inputTokens)}</td>
                    <td className={`${td} text-right`}>{n(b.outputTokens)}</td>
                    <td className={`${td} text-right`}>
                      {b.calls ? `${n(Math.round(b.inputTokens / b.calls))} / ${n(Math.round(b.outputTokens / b.calls))}` : "—"}
                    </td>
                    <td className={`${td} text-right`}>{thb(b.costUsd)}</td>
                  </tr>
                ))}
                <tr>
                  <td className={`${td} text-[var(--muted)]`}>ล้มเหลว / หมดเวลา (ไม่คิดเงินผู้ใช้)</td>
                  <td className={`${td} text-right text-[var(--muted)]`}>{n(data.failedCalls)}</td>
                  <td className={td} colSpan={4} />
                </tr>
              </tbody>
            </table>
          </div>

          {data.byModel.length ? (
            <>
              <h3 className="mb-1 mt-4 text-xs font-semibold text-[var(--foreground)]">แยกตามโมเดล</h3>
              <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
                <table className="min-w-full">
                  <thead className="bg-[var(--surface-2)]">
                    <tr>
                      <th className={th}>โมเดล</th>
                      <th className={`${th} text-right`}>ครั้ง</th>
                      <th className={`${th} text-right`}>token เข้า / ออก</th>
                      <th className={`${th} text-right`}>ต้นทุน</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {data.byModel.map((m) => (
                      <tr key={m.modelId}>
                        <td className={td}>{m.modelId}</td>
                        <td className={`${td} text-right`}>{n(m.calls)}</td>
                        <td className={`${td} text-right`}>{n(m.inputTokens)} / {n(m.outputTokens)}</td>
                        <td className={`${td} text-right`}>{thb(m.costUsd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}

          {data.daily.length ? (
            <>
              <h3 className="mb-1 mt-4 text-xs font-semibold text-[var(--foreground)]">รายวัน (14 วันล่าสุด)</h3>
              <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
                <table className="min-w-full">
                  <thead className="bg-[var(--surface-2)]">
                    <tr>
                      <th className={th}>วัน</th>
                      <th className={`${th} text-right`}>คำตอบ</th>
                      <th className={`${th} text-right`}>ต้นทุนรวม</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {data.daily.map((d) => (
                      <tr key={d.day}>
                        <td className={td}>{d.day}</td>
                        <td className={`${td} text-right`}>{n(d.answers)}</td>
                        <td className={`${td} text-right`}>{formatBaht(d.costThb)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </>
      ) : null}
    </Card>
  );
}
