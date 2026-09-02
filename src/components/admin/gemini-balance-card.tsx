"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Badge,
  Button,
  Card,
  Field,
  TextInput,
  adminFetch,
} from "./ui";
import { formatBaht } from "@/config/ai-pricing";

type BalanceView = {
  tracked: boolean;
  balanceAtRecordUsd: number | null;
  recordedAt: string | null;
  lowThresholdUsd: number;
  note: string | null;
  spendSinceUsd: number;
  spendTodayUsd: number;
  spendMonthUsd: number;
  remainingUsd: number | null;
  status: "ok" | "low" | "empty" | "untracked";
  usdToThb: number;
  aistudioBillingUrl: string;
  topUpThb: number | null;
  remainingThb: number | null;
  spendSinceThb: number;
  spendTodayThb: number;
  spendMonthThb: number;
  lowThresholdThb: number;
  revenueSinceThb: number;
  profitThb: number;
  profitVsTopUpThb: number | null;
  breakEvenGapThb: number | null;
  readingsSince: number;
};

function fmtUsd(n: number) {
  return `$${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function statusLabel(status: BalanceView["status"]) {
  switch (status) {
    case "ok":
      return { text: "ปกติ", tone: "green" as const };
    case "low":
      return { text: "ใกล้หมด", tone: "gold" as const };
    case "empty":
      return { text: "หมดแล้ว", tone: "red" as const };
    default:
      return { text: "ยังไม่ติดตาม", tone: "muted" as const };
  }
}

/**
 * Gemini Prepay in baht — Google has no remaining-balance API, so admins enter
 * the top-up (e.g. ฿400) and we subtract estimated token spend vs customer cash in.
 */
export function GeminiBalanceCard() {
  const [data, setData] = useState<BalanceView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [topUpInput, setTopUpInput] = useState("");
  const [thresholdInput, setThresholdInput] = useState("50");
  const [noteInput, setNoteInput] = useState("");

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const view = await adminFetch<BalanceView>("/api/admin/gemini-balance");
      setData(view);
      setThresholdInput(
        String(Math.round(view.lowThresholdThb || 50)),
      );
      setNoteInput(view.note ?? "");
      if (!view.tracked) setTopUpInput("");
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "โหลดยอด Gemini ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function save(asNewTopUp: boolean) {
    const lowThresholdThb = Number(thresholdInput);
    if (!Number.isFinite(lowThresholdThb) || lowThresholdThb < 0) {
      setError("กรุณาใส่เกณฑ์เตือนเป็นตัวเลข (บาท)");
      return;
    }

    const body: Record<string, unknown> = {
      lowThresholdThb,
      note: noteInput.trim() || null,
    };

    if (asNewTopUp || !data?.tracked) {
      const balanceThb = Number(topUpInput);
      if (!Number.isFinite(balanceThb) || balanceThb < 0) {
        setError("กรุณาใส่ยอดที่เติมเป็นบาท เช่น 400");
        return;
      }
      body.balanceThb = balanceThb;
    }

    setSaving(true);
    setError(null);
    try {
      const view = await adminFetch<BalanceView>("/api/admin/gemini-balance", {
        method: "PUT",
        body: JSON.stringify(body),
      });
      setData(view);
      setTopUpInput("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  async function clear() {
    if (!confirm("ล้างการติดตามยอดเติมนี้?")) return;
    setSaving(true);
    setError(null);
    try {
      const view = await adminFetch<BalanceView>("/api/admin/gemini-balance", {
        method: "PUT",
        body: JSON.stringify({ clear: true }),
      });
      setData(view);
      setTopUpInput("");
      setNoteInput("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "ล้างไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  const badge = statusLabel(data?.status ?? "untracked");
  const alertBorder =
    data?.status === "empty" || data?.status === "low"
      ? "border-[var(--danger)]/40"
      : undefined;
  const profit = data?.profitThb ?? 0;
  const vsTopUp = data?.profitVsTopUpThb;
  const costPerReading =
    data && data.readingsSince > 0 && data.spendSinceThb > 0
      ? data.spendSinceThb / data.readingsSince
      : null;

  return (
    <Card className={`mb-4 ${alertBorder ?? ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-[var(--foreground)]">
              เครดิต Gemini ที่เติม
            </h2>
            <Badge tone={badge.tone}>{badge.text}</Badge>
          </div>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-[var(--muted)]">
            ใส่ยอดที่เติมจริง เช่น 400 บาท — ระบบหักค่าโมเดลจาก token ที่ใช้
            แล้วเทียบกับเงินลูกค้าที่โอนเข้าช่วงเดียวกัน
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/admin/costs"
            className="text-xs text-[var(--primary)] hover:underline"
          >
            ต้นทุนรายคน →
          </Link>
          <a
            href={data?.aistudioBillingUrl ?? "https://aistudio.google.com/plans"}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[var(--primary)] hover:underline"
          >
            เปิดบิล AI Studio →
          </a>
        </div>
      </div>

      {loading ? (
        <p className="mt-3 text-xs text-[var(--muted)]">กำลังโหลด…</p>
      ) : (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-[11px] text-[var(--muted)]">เหลือประมาณ</p>
              <p
                className={`mt-0.5 text-lg font-semibold tabular-nums ${
                  data?.status === "empty" || data?.status === "low"
                    ? "text-[var(--danger)]"
                    : "text-[var(--foreground)]"
                }`}
              >
                {data?.remainingThb != null ? formatBaht(data.remainingThb) : "—"}
              </p>
              {data?.remainingUsd != null ? (
                <p className="text-[10px] text-[var(--muted-2)]">
                  ≈ {fmtUsd(data.remainingUsd)}
                </p>
              ) : null}
            </div>
            <div>
              <p className="text-[11px] text-[var(--muted)]">ใช้ไปแล้ว</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums">
                {data?.tracked ? formatBaht(data.spendSinceThb) : "—"}
              </p>
              {data?.tracked && data.topUpThb != null ? (
                <p className="text-[10px] text-[var(--muted-2)]">
                  จากที่เติม {formatBaht(data.topUpThb)}
                </p>
              ) : (
                <p className="text-[10px] text-[var(--muted-2)]">
                  วันนี้ {formatBaht(data?.spendTodayThb ?? 0)} · เดือนนี้{" "}
                  {formatBaht(data?.spendMonthThb ?? 0)}
                </p>
              )}
            </div>
            <div>
              <p className="text-[11px] text-[var(--muted)]">เงินลูกค้าเข้า</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums">
                {formatBaht(data?.revenueSinceThb ?? 0)}
              </p>
              <p className="text-[10px] text-[var(--muted-2)]">
                สลิปที่อนุมัติ
                {data?.readingsSince
                  ? ` · ${data.readingsSince.toLocaleString("th-TH")} คำทำนาย`
                  : ""}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-[var(--muted)]">กำไรสุทธิ</p>
              <p
                className={`mt-0.5 text-lg font-semibold tabular-nums ${
                  profit < 0
                    ? "text-[var(--danger)]"
                    : "text-[var(--secondary-active)]"
                }`}
              >
                {profit >= 0 ? "+" : ""}
                {formatBaht(profit)}
              </p>
              <p className="text-[10px] text-[var(--muted-2)]">
                เงินเข้า − ค่าโมเดลที่ใช้
              </p>
            </div>
          </div>

          {data?.tracked && data.topUpThb != null ? (
            <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5">
              <p className="text-xs leading-relaxed text-[var(--foreground)]">
                เติมมา {formatBaht(data.topUpThb)}
                {vsTopUp != null ? (
                  <>
                    {" "}
                    · เทียบทั้งก้อน{" "}
                    <span
                      className={
                        vsTopUp >= 0
                          ? "font-medium text-[var(--secondary-active)]"
                          : "font-medium text-[var(--danger)]"
                      }
                    >
                      {vsTopUp >= 0 ? "คุ้มแล้ว " : "ยังไม่คุ้ม "}
                      {formatBaht(Math.abs(vsTopUp))}
                    </span>
                  </>
                ) : null}
                {data.breakEvenGapThb != null && data.breakEvenGapThb > 0 ? (
                  <> — ต้องมียอดโอนเข้าอีก {formatBaht(data.breakEvenGapThb)} ถึงจุดคุ้มทุน</>
                ) : null}
              </p>
              {costPerReading != null ? (
                <p className="mt-1 text-[11px] text-[var(--muted)]">
                  ต้นทุนเฉลี่ย {formatBaht(costPerReading)} ต่อคำทำนาย
                  {data.topUpThb > 0
                    ? ` · เครดิตนี้รับได้ประมาณ ${Math.max(0, Math.floor(data.topUpThb / costPerReading)).toLocaleString("th-TH")} คำ`
                    : ""}
                </p>
              ) : null}
            </div>
          ) : null}

          {data?.tracked && data.recordedAt ? (
            <p className="mt-2 text-[11px] text-[var(--muted-2)]">
              เริ่มนับ{" "}
              {new Date(data.recordedAt).toLocaleString("th-TH", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
              {data.note ? ` · ${data.note}` : ""}
              {" · "}
              วันนี้ {formatBaht(data.spendTodayThb)} · เดือนนี้{" "}
              {formatBaht(data.spendMonthThb)}
            </p>
          ) : null}

          {(data?.status === "low" || data?.status === "empty") && (
            <p className="mt-2 text-xs text-[var(--danger)]">
              {data.status === "empty"
                ? "เครดิตประมาณหมดแล้ว — เติมใน AI Studio แล้วบันทึกยอดใหม่ด้านล่าง"
                : `เหลือต่ำกว่าเกณฑ์เตือน (${formatBaht(data.lowThresholdThb)}) — ควรเติม`}
            </p>
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Field
              label="ยอดที่เติม (บาท)"
              hint={
                data?.tracked
                  ? "ใส่เฉพาะตอนเติมรอบใหม่ — ยอดคงเหลือด้านบนหักให้อัตโนมัติ"
                  : "เช่น 400 ตามใบเสร็จที่จ่าย Google"
              }
            >
              <TextInput
                type="number"
                min={0}
                step="1"
                inputMode="decimal"
                value={topUpInput}
                onChange={(e) => setTopUpInput(e.target.value)}
                placeholder="400"
              />
            </Field>
            <Field label="เตือนเมื่อเหลือต่ำกว่า (บาท)">
              <TextInput
                type="number"
                min={0}
                step="1"
                inputMode="decimal"
                value={thresholdInput}
                onChange={(e) => setThresholdInput(e.target.value)}
              />
            </Field>
            <Field label="หมายเหตุ (ไม่บังคับ)">
              <TextInput
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                placeholder="เช่น เติม Gemini 400 บาท ก.ย. 69"
                maxLength={300}
              />
            </Field>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              onClick={() => void save(!data?.tracked || topUpInput.trim() !== "")}
              disabled={saving}
            >
              {saving
                ? "กำลังบันทึก…"
                : !data?.tracked || topUpInput.trim() !== ""
                  ? "บันทึกยอดที่เติม"
                  : "บันทึกเกณฑ์เตือน"}
            </Button>
            <Button variant="ghost" onClick={() => void load()} disabled={saving}>
              รีเฟรช
            </Button>
            {data?.tracked ? (
              <Button variant="danger" onClick={() => void clear()} disabled={saving}>
                ล้างการติดตาม
              </Button>
            ) : null}
          </div>
        </>
      )}

      {error ? (
        <p className="mt-3 text-xs text-[var(--danger)]">{error}</p>
      ) : null}
    </Card>
  );
}
