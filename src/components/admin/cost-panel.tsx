"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AdminPage,
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
import { formatThb, usdToThb } from "@/config/ai-pricing";

type Row = {
  userId: string;
  email: string;
  name: string | null;
  plan: "FREE" | "PRO";
  packageName: string | null;
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
  };
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

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await adminFetch<Summary>(`/api/admin/costs?months=${months}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลดข้อมูลต้นทุนไม่สำเร็จ");
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
        title="ต้นทุนและกำไรต่อผู้ใช้"
        description="ต้นทุน AI จริงจาก token ที่ใช้ เทียบกับรายได้ตามแพ็กเกจ — ตอบว่าราคาที่ตั้งไว้กำไรหรือขาดทุน"
      />

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

      {!data ? (
        <TableSkeleton />
      ) : (
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
              hint={`$${t!.costUsd.toFixed(2)} · ${num(t!.aiCalls)} ครั้งที่เรียกโมเดล`}
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
              label="ต้นทุนต่อคำทำนาย"
              value={
                costPerReadingUsd != null ? formatThb(costPerReadingUsd) : "—"
              }
              hint={`${num(t!.readings)} คำทำนาย`}
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
                ⚠️ มี {num(t!.unprofitableUsers)} ผู้ใช้ที่{" "}
                <strong>ต้นทุน AI สูงกว่าเงินที่จ่าย</strong> — ดูแถวที่ขึ้นสีแดงด้านล่าง
              </p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Output token แพงกว่า input 6 เท่า ($9.00 vs $1.50 ต่อ 1M) — คนที่ใช้โหมด
                “ละเอียด” ในเธรดยาว ๆ คือกลุ่มที่กินต้นทุนมากที่สุด
              </p>
            </Card>
          ) : null}

          <div className="mt-4">
            <TableShell>
              <thead>
                <tr>
                  <Th>ผู้ใช้</Th>
                  <Th>แพ็กเกจ</Th>
                  <Th className="text-right">คำทำนาย</Th>
                  <Th className="text-right">Token (เข้า / ออก)</Th>
                  <Th className="text-right">ต้นทุน</Th>
                  <Th className="text-right">ต่อคำทำนาย</Th>
                  <Th className="text-right">รายได้</Th>
                  <Th className="text-right">กำไร</Th>
                </tr>
              </thead>
              <tbody>
                {data.rows.length === 0 ? (
                  <tr>
                    <Td colSpan={8}>
                      <p className="py-6 text-center text-sm text-[var(--muted)]">
                        ยังไม่มีการใช้งาน AI ในช่วงนี้
                      </p>
                    </Td>
                  </tr>
                ) : (
                  data.rows.map((r) => {
                    const costThb = usdToThb(r.costUsd);
                    const profit = r.revenueThb - costThb;
                    const losing = costThb > r.revenueThb;
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
                        <Td className="text-right tabular-nums text-[var(--muted)]">
                          {num(r.inputTokens)} / {num(r.outputTokens)}
                        </Td>
                        <Td className="text-right tabular-nums">
                          {formatThb(r.costUsd)}
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
                              : "text-[var(--secondary-active)]"
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
            ต้นทุนคำนวณจาก token ที่บันทึกไว้จริง × ราคาปัจจุบันของแต่ละโมเดล (อัตรา $1 ={" "}
            {data.usdToThb}฿) · นับรวมการเรียกโมเดลเสริมสำหรับสรุปและคำถามต่อ
            ซึ่งไม่คิดเครดิตกับผู้ใช้แต่เรามีค่าใช้จ่าย · รายได้คิดจากราคาแพ็กเกจที่ใช้งานอยู่
          </p>
        </>
      )}
    </AdminPage>
  );
}
