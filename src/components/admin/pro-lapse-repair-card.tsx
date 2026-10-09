"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button, Card, IconTile, adminFetch } from "./ui";

type Row = { userId: string; email: string | null; lapsedAt: string; proUntil: string | null; before: number; after: number };
type Result = { applied: boolean; rows: Row[]; skipped: number; lapsesSeen: number };

const n = (v: number) => v.toLocaleString("th-TH");
const day = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "numeric" }) : "ไม่มีวันหมด";

/**
 * One-off repair for the 1 Oct 2026 lapse that cut paying Pro users to the
 * Free budget. Runs on the server: the production database is internal.
 */
export function ProLapseRepairCard() {
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(apply: boolean) {
    setBusy(true);
    setError(null);
    try {
      setResult(await adminFetch<Result>("/api/admin/repair-pro-lapse", { method: apply ? "POST" : "GET" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "ทำไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mb-4">
      <h2 className="flex items-center gap-2.5 text-sm font-semibold text-[var(--foreground)]">
        <IconTile icon={RotateCcw} tone="green" size="sm" />คืน usage ลูกค้า Pro ที่ถูกตัดเมื่อ 1 ต.ค.</h2>
      <p className="mt-1 max-w-2xl text-xs leading-relaxed text-[var(--muted)]">
        รอบโปรโมชันเดือนกันยาหมดวันที่ 1 ต.ค. แล้วระบบลด usage ของทุกคนเหลืองบ Free รวมถึงลูกค้าที่จ่าย Pro อยู่
        (แก้ระบบแล้ว) ปุ่มนี้คืนยอดที่ถูกตัดให้เฉพาะคนที่ยังเป็น Pro — กด “ตรวจดู” ก่อน ไม่มีอะไรเปลี่ยน
        แล้วค่อยกด “คืนยอด” (กดซ้ำได้ ไม่คืนซ้ำ · SUPER_ADMIN เท่านั้น · บันทึก audit)
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button onClick={() => void run(false)} disabled={busy}>
          ตรวจดู
        </Button>
        <Button onClick={() => void run(true)} disabled={busy || !result || result.applied || result.rows.length === 0}>
          คืนยอด {result && !result.applied && result.rows.length ? `${result.rows.length} คน` : ""}
        </Button>
      </div>
      {error ? <p className="mt-3 text-xs text-[var(--danger)]">{error}</p> : null}
      {result ? (
        <div className="mt-3 text-xs text-[var(--foreground)]">
          <p className="mb-2">
            {result.applied ? "คืนยอดแล้ว" : "จะคืนยอด"} {n(result.rows.length)} คน · ข้าม {n(result.skipped)} (คืนแล้วหรือได้รอบใหม่แล้ว) ·
            พบการตัดยอดทั้งหมด {n(result.lapsesSeen)} ครั้ง
          </p>
          {result.rows.length ? (
            <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
              <table className="min-w-full">
                <thead className="bg-[var(--surface-2)] text-[11px] text-[var(--muted)]">
                  <tr>
                    <th className="px-2 py-1.5 text-left">ผู้ใช้</th>
                    <th className="px-2 py-1.5 text-left">ถูกตัดเมื่อ</th>
                    <th className="px-2 py-1.5 text-left">Pro ถึง</th>
                    <th className="px-2 py-1.5 text-right">usage ก่อน → หลัง (หน่วย)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {result.rows.map((r) => (
                    <tr key={r.userId}>
                      <td className="px-2 py-1.5">{r.email ?? r.userId}</td>
                      <td className="px-2 py-1.5">{day(r.lapsedAt)}</td>
                      <td className="px-2 py-1.5">{day(r.proUntil)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {n(r.before)} → {n(r.after)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
