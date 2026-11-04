"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { adminDay } from "@/lib/admin-dates";
import type { PaymentHistoryItem, PaymentHistoryList } from "@/lib/payment-history";
import { AdminDateInput } from "./date-input";
import { Badge, Button, Field, Select, TableShell, TableSkeleton, Td, TextInput, Th, adminFetch } from "./ui";

const empty = { search: "", status: "", reviewerId: "", from: "", to: "" };
function moment(value: string | null) {
  return value ? `${adminDay(value)} ${new Date(value).toLocaleTimeString("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" })}` : "—";
}
function Validity({ item }: { item: PaymentHistoryItem }) {
  if (item.status === "REJECTED") return <span>ไม่ได้เพิ่มสิทธิ</span>;
  const receipt = item.receipt;
  if (!receipt) return <span className="text-[var(--muted)]">รายการเดิมไม่ได้บันทึกระยะเวลาไว้</span>;
  const rule = receipt.expiryRule;
  const label = rule?.mode === "DAYS" ? `${receipt.kind === "SUBSCRIPTION" ? "เพิ่มอายุสมาชิก" : "เงื่อนไขแพ็ก"} ${rule.days} วัน`
    : rule?.mode === "DATE" ? `เงื่อนไขแพ็กถึง ${adminDay(rule.date)}`
      : rule?.mode === "NONE" ? "เงื่อนไขแพ็กไม่มีวันหมดอายุ" : "ตามอายุคำถามเดิม";
  return <div className="min-w-44 space-y-1 text-xs">
    <p>{label}</p>
    <p className="text-[var(--muted)]">เริ่ม {moment(receipt.startsAt)}</p>
    <p>ใช้ได้จริง: {receipt.expiresAt ? `ถึง ${moment(receipt.expiresAt)}` : "ไม่มีวันหมดอายุ"}</p>
  </div>;
}

export function PaymentHistory({ refreshKey = 0 }: { refreshKey?: number }) {
  const [draft, setDraft] = useState(empty), [filters, setFilters] = useState(empty);
  const [page, setPage] = useState(1), [reload, setReload] = useState(0), [reset, setReset] = useState(0);
  const [data, setData] = useState<PaymentHistoryList | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState<string | null>(null);
  const fromInput = useRef<HTMLInputElement>(null), toInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), pageSize: "20" });
      for (const [key, value] of Object.entries(filters)) if (value.trim()) params.set(key, value.trim());
      try {
        const result = await adminFetch<PaymentHistoryList>(`/api/admin/payments/history?${params}`);
        if (!cancelled) { setData(result); setPage(result.page); setError(null); }
      } catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : "โหลดประวัติไม่สำเร็จ"); }
      finally { if (!cancelled) setLoading(false); }
    }
    // Loading state follows an asynchronous, independently filtered history.
    void load();
    return () => { cancelled = true; };
  }, [filters, page, reload, refreshKey]);

  function apply(event: FormEvent) {
    event.preventDefault();
    for (const [value, ref] of [[draft.from, fromInput], [draft.to, toInput]] as const) {
      if (ref.current?.value.trim() && !value) { setError("กรุณาระบุวันที่เป็น dd/mm/yyyy ให้ถูกต้อง"); ref.current.focus(); return; }
    }
    if (draft.from && draft.to && draft.from > draft.to) { setError("วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด"); return; }
    setPage(1); setFilters({ ...draft });
  }
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / 20));
  return <section className="mt-10 border-t border-[var(--border)] pt-6" aria-labelledby="payment-history-title">
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div><h2 id="payment-history-title" className="text-lg font-semibold">ประวัติการดำเนินการ</h2>
        <p className="mt-1 text-xs text-[var(--muted)]">รายการที่อนุมัติหรือปฏิเสธแล้ว · ข้อมูลสิทธิถูกบันทึก ณ เวลาตรวจ และไม่เปลี่ยนตามการแก้แพ็กภายหลัง</p>
        <p className="mt-1 text-xs text-[var(--muted)]">รายการเก่าที่ไม่มีรายละเอียดสิทธิจะระบุว่าไม่ได้บันทึกไว้ · ช่วงวันที่นับจากเวลาตรวจตามเวลาไทย</p></div>
      <Button variant="ghost" onClick={() => setReload(x => x + 1)} disabled={loading}>โหลดประวัติใหม่</Button>
    </div>
    <form onSubmit={apply} className="mb-4 flex flex-wrap items-end gap-3">
      <Field label="ค้นหาประวัติ"><TextInput aria-label="ค้นหาประวัติ" placeholder="ชื่อ อีเมล หรือเลขรายการ" value={draft.search} className="w-60" onChange={e => setDraft({ ...draft, search: e.target.value })}/></Field>
      <Field label="ผลการตรวจ"><Select aria-label="ผลการตรวจประวัติ" value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value })}>
        <option value="">อนุมัติและปฏิเสธ</option><option value="APPROVED">อนุมัติแล้ว</option><option value="REJECTED">ปฏิเสธแล้ว</option>
      </Select></Field>
      <Field label="แอดมินผู้ตรวจ"><Select aria-label="แอดมินผู้ตรวจประวัติ" value={draft.reviewerId} className="max-w-60" onChange={e => setDraft({ ...draft, reviewerId: e.target.value })}>
        <option value="">แอดมินทุกคน</option>{data?.reviewers.map(r => <option key={r.id} value={r.id}>{r.name || r.email}</option>)}
      </Select></Field>
      <div key={reset} className="flex flex-wrap gap-3">
        <Field label="ตั้งแต่วันที่"><AdminDateInput ref={fromInput} label="ประวัติตั้งแต่วันที่" value={draft.from} onChange={from => setDraft(d => ({ ...d, from }))}/></Field>
        <Field label="ถึงวันที่"><AdminDateInput ref={toInput} label="ประวัติถึงวันที่" value={draft.to} onChange={to => setDraft(d => ({ ...d, to }))}/></Field>
      </div>
      <Button type="submit" disabled={loading}>ค้นหาประวัติ</Button>
      <Button variant="ghost" onClick={() => { setDraft(empty); setFilters({ ...empty }); setPage(1); setReset(x => x + 1); }} disabled={loading}>ล้างตัวกรอง</Button>
    </form>
    {error && <p role="alert" className="mb-3 text-sm text-[var(--danger)]">{error}</p>}
    <p className="mb-2 text-[10px] text-[var(--muted)] md:hidden">เลื่อนตารางไปทางขวาเพื่อดูผู้ตรวจและรายละเอียดสิทธิ</p>
    <div aria-busy={loading}>
      {loading && !data ? <TableSkeleton rows={3}/> : <TableShell>
        <caption className="sr-only">ประวัติการดำเนินการตรวจการโอนเงิน</caption>
        <thead><tr><Th>วันเวลาตรวจ</Th><Th>ผู้แจ้ง</Th><Th>รายการ / ยอดเงิน</Th><Th>ผลตรวจ</Th><Th>จำนวนที่ได้รับ</Th><Th>ระยะเวลา / วันหมดอายุ</Th><Th>ผู้ตรวจ</Th><Th>หมายเหตุ</Th></tr></thead>
        <tbody>{data?.items.map(item => <tr key={item.id}>
          <Td className="whitespace-nowrap text-xs"><p>{moment(item.reviewedAt)}</p><p className="mt-1 text-[var(--muted)]">แจ้ง {moment(item.submittedAt)}</p><p className="text-[var(--muted)]">โอน {moment(item.transferredAt)}</p></Td>
          <Td><Link href={`/admin/users/${item.member.id}`} className="block max-w-48 break-words text-xs text-[var(--primary)] hover:underline">{item.member.name || item.member.email}</Link><p className="mt-1 max-w-48 break-all text-[10px] text-[var(--muted)]">{item.member.email}</p></Td>
          <Td><p className="max-w-48 break-words text-xs">{item.receipt?.packageName || (item.packageCode ? `แพ็กเดิม (รหัส ${item.packageCode})` : "ไม่ระบุแพ็ก")}</p><p className="mt-1 text-sm font-medium">฿{item.amount.toLocaleString("th-TH")}</p><p className="mt-1 max-w-40 break-all text-[10px] text-[var(--muted)]">{item.id}</p></Td>
          <Td className="whitespace-nowrap"><Badge tone={item.status === "APPROVED" ? "green" : "red"}>{item.status === "APPROVED" ? "อนุมัติแล้ว" : "ปฏิเสธแล้ว"}</Badge></Td>
          <Td className="whitespace-nowrap text-xs">{item.status === "REJECTED" ? "0 คำถาม" : item.receipt ? <><p>+{item.receipt.questionsAdded.toLocaleString("th-TH")} คำถาม</p>{item.receipt.creditsAdded > 0 && <p className="mt-1 text-[var(--muted)]">+{item.receipt.creditsAdded} เครดิตเดิม</p>}</> : "ไม่ได้บันทึกไว้"}</Td>
          <Td><Validity item={item}/></Td>
          <Td><p className="max-w-48 break-words text-xs">{item.reviewer?.name || item.reviewer?.email || "ไม่พบผู้ตรวจในข้อมูลเดิม"}</p><p className="mt-1 max-w-48 break-all text-[10px] text-[var(--muted)]">{item.reviewer?.email}</p>{item.selfReview && <p className="mt-1 text-[10px] text-[var(--primary)]">ตรวจรายการของตัวเอง</p>}</Td>
          <Td className="text-xs"><p className="min-w-32 max-w-64 whitespace-pre-wrap break-words">{item.note || "—"}</p></Td>
        </tr>)}{data?.items.length === 0 && <tr><Td colSpan={8} className="text-center text-xs text-[var(--muted)]">ไม่มีประวัติที่ตรงกับตัวกรอง</Td></tr>}</tbody>
      </TableShell>}
    </div>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--muted)]">
      <span aria-live="polite">ประวัติทั้งหมด {data?.total ?? 0} รายการ · หน้า {page}/{totalPages}</span>
      <div className="flex gap-2"><Button variant="ghost" disabled={loading || page <= 1} onClick={() => setPage(p => p - 1)}>ประวัติหน้าก่อน</Button><Button variant="ghost" disabled={loading || page >= totalPages} onClick={() => setPage(p => p + 1)}>ประวัติหน้าถัดไป</Button></div>
    </div>
  </section>;
}
