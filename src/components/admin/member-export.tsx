"use client";
import { useState } from "react";
import { Button, Select } from "./ui";
import { EXPORT_RANGES, type ExportRange } from "@/lib/member-export";
export function MemberExport({ search, status }: { search: string; status: string }) {
  const [range, setRange] = useState<ExportRange>("28"), [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function download() {
    setBusy(true); setError("");
    try {
      const params = new URLSearchParams({ range });
      if (search.trim()) params.set("search", search.trim());
      if (status) params.set("status", status);
      const response = await fetch(`/api/admin/users/export?${params}`, { cache: "no-store" });
      if (!response.ok) { const json = await response.json().catch(() => null); throw new Error(json?.error?.message ?? "ดาวน์โหลดไม่สำเร็จ"); }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a"); link.href = url; link.download = `horasard-members-signup-${range}.csv`; link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { setError(e instanceof Error ? e.message : "ดาวน์โหลดไม่สำเร็จ"); } finally { setBusy(false); }
  }
  return <div className="mb-4 rounded-xl border border-[var(--border)] p-3">
    <div className="flex flex-wrap items-center gap-2"><span className="text-xs">ดาวน์โหลดสมาชิกตามวันที่สมัคร</span>
      <Select aria-label="ช่วงวันที่สมัครสำหรับดาวน์โหลด" value={range} disabled={busy} onChange={e => setRange(e.target.value as ExportRange)} className="max-w-40">
        {EXPORT_RANGES.map(r => <option key={r} value={r}>{r === "month" ? "เดือนนี้" : r === "all" ? "ทั้งหมด" : `${r} วันล่าสุด`}</option>)}
      </Select><Button disabled={busy} onClick={() => void download()}>{busy ? "กำลังเตรียมไฟล์…" : "ดาวน์โหลด CSV"}</Button></div>
    <p className="mt-2 text-xs text-[var(--muted)]">เฉพาะสมาชิก · ใช้ตัวกรองชื่อ/อีเมลและสถานะปัจจุบัน · วันที่เวลาไทย · เปิดด้วย Excel ได้ · หากมีหลายชุดคำถาม แสดงวันหมดอายุที่ใกล้ที่สุด</p>
    {error && <p role="alert" className="mt-2 text-sm text-[var(--danger)]">{error}</p>}
  </div>;
}
