"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { InsightState } from "@/lib/chat-insights";
import { AdminPage, Button, Card, PageHeader, StatCard, adminFetch } from "./ui";
import { adminDay } from "@/lib/admin-dates";
type Data = InsightState & { stats?: { up: number; down: number; satisfactionPct: number | null } };
export function FeedbackPanel() {
  const [data, setData] = useState<Data | null>(null), [error, setError] = useState(""), [starting, setStarting] = useState(false);
  const sequence = useRef(0);
  const load = useCallback(async () => {
    const request = ++sequence.current;
    try { const result = await adminFetch<Data>("/api/admin/feedback"); if (request === sequence.current) { setData(result); setError(""); } }
    catch (e) { setError(e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ"); }
  }, []);
  useEffect(() => {
    const request = ++sequence.current; let active = true;
    void adminFetch<Data>("/api/admin/feedback").then(result => { if (active && request === sequence.current) setData(result); }).catch(e => { if (active) setError(e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ"); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (data?.status !== "running") return;
    const timer = window.setInterval(() => void load(), 5000); return () => window.clearInterval(timer);
  }, [data?.status, load]);
  async function generate() {
    ++sequence.current; setStarting(true); setError("");
    try { const job = await adminFetch<InsightState>("/api/admin/feedback", { method: "POST" }); setData(old => ({ ...old, ...job })); }
    catch (e) { setError(e instanceof Error ? e.message : "เริ่มสรุปไม่สำเร็จ"); } finally { setStarting(false); }
  }
  const summary = data?.summary, stats = data?.stats;
  return <AdminPage>
    <PageHeader title="ภาพรวมคำถามและคำตอบ" description="AI จัดกลุ่มหัวข้อที่พบบ่อยจากคำถามและคำตอบทั้งหมด โดยแสดงเฉพาะภาพรวม" />
    {stats && <div className="grid gap-3 sm:grid-cols-3"><StatCard label="👍 ดี" value={stats.up} tone="green" /><StatCard label="👎 ไม่ดี" value={stats.down} /><StatCard label="ความพึงพอใจ" value={stats.satisfactionPct == null ? "—" : `${stats.satisfactionPct.toFixed(0)}%`} /></div>}
    <Card className="mt-4">
      <p className="text-sm">แสดงสูงสุดฝั่งละ 50 หัวข้อ · ตัดข้อมูลระบุตัวตนก่อนส่งสรุป · ซ่อนหัวข้อที่มาจากสมาชิกน้อยกว่า 3 คน</p>
      <p className="mt-2 text-xs leading-5 text-[var(--muted)]">นับจากประวัติที่ยังอยู่และคำทำนายเก่าที่ระบุแหล่งได้ ณ เวลาเริ่มประมวลผล คำตอบนับเฉพาะที่สำเร็จ แสดงข้อความสรุปแทนบทสนทนารายคน หากข้อมูลไม่พอจะไม่สร้างหัวข้อเพิ่มให้ครบ 50</p>
      <div className="mt-3 flex flex-wrap items-center gap-3"><Button disabled={starting || data?.status === "running"} onClick={() => void generate()}>{starting || data?.status === "running" ? "กำลังประมวลผล…" : "ประมวลผลข้อมูลล่าสุด"}</Button>
      {summary && <span className="text-xs text-[var(--muted)]">อัปเดต {adminDay(summary.generatedAt)} · คำถาม {summary.questionsAnalyzed.toLocaleString()} · คำตอบ {summary.answersAnalyzed.toLocaleString()}</span>}</div>
      {data?.status === "running" && <p role="status" className="mt-3 text-xs">กำลังจัดกลุ่ม {data.processed?.toLocaleString() ?? 0} ข้อความ สามารถออกจากหน้านี้แล้วกลับมาดูผลได้</p>}
      {(error || data?.error) && <p role="alert" className="mt-3 text-sm text-[var(--danger)]">{error || data?.error}</p>}
    </Card>
    <div className="mt-4 grid gap-4 lg:grid-cols-2">{([ ["50 คำถามที่สมาชิกถามบ่อย", summary?.questions], ["50 แนวคำตอบที่ระบบตอบบ่อย", summary?.answers] ] as const).map(([title, items]) => <Card key={title}>
      <h2 className="text-sm font-semibold">{title}</h2>
      {!items?.length ? <p className="mt-4 text-sm text-[var(--muted)]">{summary ? "ยังไม่มีหัวข้อที่มีข้อมูลจากสมาชิกอย่างน้อย 3 คน" : "กดประมวลผลข้อมูลล่าสุดเพื่อสร้างภาพรวม"}</p> : <ol className="mt-3 divide-y divide-[var(--border)]">{items.map((item, i) => <li key={i} className="flex gap-3 py-3 text-sm"><span className="text-[var(--muted)]">{i + 1}.</span><span className="min-w-0 flex-1 break-words">{item.label}</span><span className="shrink-0 text-xs text-[var(--primary)]">{item.count.toLocaleString()} ครั้ง</span></li>)}</ol>}
    </Card>)}</div>
  </AdminPage>;
}
