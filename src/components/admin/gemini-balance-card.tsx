"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Field,
  TextInput,
  adminFetch,
} from "./ui";
import { formatThb } from "@/config/ai-pricing";

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
 * Manual Gemini Prepay tracker — Google has no public remaining-balance API,
 * so admins paste the AI Studio figure and we subtract estimated spend.
 */
export function GeminiBalanceCard() {
  const [data, setData] = useState<BalanceView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [balanceInput, setBalanceInput] = useState("");
  const [thresholdInput, setThresholdInput] = useState("10");
  const [noteInput, setNoteInput] = useState("");

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const view = await adminFetch<BalanceView>("/api/admin/gemini-balance");
      setData(view);
      setThresholdInput(String(view.lowThresholdUsd));
      setNoteInput(view.note ?? "");
      if (view.remainingUsd != null) {
        setBalanceInput(view.remainingUsd.toFixed(2));
      } else if (view.balanceAtRecordUsd != null) {
        setBalanceInput(view.balanceAtRecordUsd.toFixed(2));
      }
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

  async function save() {
    const balanceUsd = Number(balanceInput);
    const lowThresholdUsd = Number(thresholdInput);
    if (!Number.isFinite(balanceUsd) || balanceUsd < 0) {
      setError("กรุณาใส่ยอดคงเหลือเป็นตัวเลข (USD)");
      return;
    }
    if (!Number.isFinite(lowThresholdUsd) || lowThresholdUsd < 0) {
      setError("กรุณาใส่เกณฑ์เตือนเป็นตัวเลข (USD)");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const view = await adminFetch<BalanceView>("/api/admin/gemini-balance", {
        method: "PUT",
        body: JSON.stringify({
          balanceUsd,
          lowThresholdUsd,
          note: noteInput.trim() || null,
        }),
      });
      setData(view);
      setBalanceInput(
        view.remainingUsd != null
          ? view.remainingUsd.toFixed(2)
          : balanceUsd.toFixed(2),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  async function clear() {
    if (!confirm("ล้างการติดตามยอด Prepay นี้?")) return;
    setSaving(true);
    setError(null);
    try {
      const view = await adminFetch<BalanceView>("/api/admin/gemini-balance", {
        method: "PUT",
        body: JSON.stringify({ clear: true }),
      });
      setData(view);
      setBalanceInput("");
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

  return (
    <Card className={`mb-4 ${alertBorder ?? ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-[var(--foreground)]">
              เครดิต Gemini Prepay
            </h2>
            <Badge tone={badge.tone}>{badge.text}</Badge>
          </div>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-[var(--muted)]">
            Google ไม่มี API ดูยอดคงเหลือ — ใส่ยอดจาก AI Studio แล้วระบบจะหักการใช้
            Gemini ที่ประมาณจาก token ในระบบ (อาจต่างจากบิลจริงเล็กน้อย)
          </p>
        </div>
        <a
          href={data?.aistudioBillingUrl ?? "https://aistudio.google.com/plans"}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-[var(--primary)] hover:underline"
        >
          เปิด AI Studio Billing →
        </a>
      </div>

      {loading ? (
        <p className="mt-3 text-xs text-[var(--muted)]">กำลังโหลด…</p>
      ) : (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-[11px] text-[var(--muted)]">ประมาณคงเหลือ</p>
              <p
                className={`mt-0.5 text-lg font-semibold tabular-nums ${
                  data?.status === "empty" || data?.status === "low"
                    ? "text-[var(--danger)]"
                    : "text-[var(--foreground)]"
                }`}
              >
                {data?.remainingUsd != null ? fmtUsd(data.remainingUsd) : "—"}
              </p>
              {data?.remainingUsd != null ? (
                <p className="text-[10px] text-[var(--muted-2)]">
                  ≈ {formatThb(data.remainingUsd)}
                </p>
              ) : null}
            </div>
            <div>
              <p className="text-[11px] text-[var(--muted)]">ใช้ไปตั้งแต่บันทึก</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums">
                {data?.tracked ? fmtUsd(data.spendSinceUsd) : "—"}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-[var(--muted)]">ใช้วันนี้</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums">
                {fmtUsd(data?.spendTodayUsd ?? 0)}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-[var(--muted)]">ใช้เดือนนี้</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums">
                {fmtUsd(data?.spendMonthUsd ?? 0)}
              </p>
            </div>
          </div>

          {data?.tracked && data.recordedAt ? (
            <p className="mt-2 text-[11px] text-[var(--muted-2)]">
              บันทึกล่าสุด {fmtUsd(data.balanceAtRecordUsd ?? 0)} เมื่อ{" "}
              {new Date(data.recordedAt).toLocaleString("th-TH", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
              {data.note ? ` · ${data.note}` : ""}
            </p>
          ) : null}

          {(data?.status === "low" || data?.status === "empty") && (
            <p className="mt-2 text-xs text-[var(--danger)]">
              {data.status === "empty"
                ? "ยอดประมาณหมดแล้ว — เติม Prepay ใน AI Studio แล้วอัปเดตตัวเลขด้านล่าง"
                : `ยอดต่ำกว่าเกณฑ์เตือน ($${data.lowThresholdUsd}) — ควรเติมเครดิต`}
            </p>
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Field
              label="ยอดคงเหลือจาก AI Studio (USD)"
              hint="คัดลอกจากหน้า Billing แล้วกดบันทึก — นับการใช้ใหม่ตั้งแต่นาทีนี้"
            >
              <TextInput
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={balanceInput}
                onChange={(e) => setBalanceInput(e.target.value)}
                placeholder="เช่น 50.00"
              />
            </Field>
            <Field label="เตือนเมื่อต่ำกว่า (USD)">
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
                placeholder="เช่น เติม $50 รอบ ก.ค."
                maxLength={300}
              />
            </Field>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? "กำลังบันทึก…" : "บันทึกยอด"}
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
