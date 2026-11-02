"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { AdminPage, Badge, Button, InfoBox, PageHeader, Select, TableShell, TableSkeleton, Td, TextInput, Th, adminFetch } from "./ui";
import { PageJump } from "./table-controls";
const labels: Record<string,string> = {PENDING:"รอดำเนินการ",SENT:"ส่งออกแล้ว",DELIVERED:"Delivered · ปลายทางรับแล้ว",BOUNCED:"Bounced · ตีกลับ",COMPLAINED:"แจ้งสแปม",FAILED:"ส่งไม่สำเร็จ",DELAYED:"ส่งล่าช้า",DEV:"ทดสอบในเครื่อง"};
type Row = {id:string;providerId:string|null;recipient:string;subject:string;category:string;status:string;error:string|null;createdAt:string;statusAt:string};
type Result = {items:Row[];total:number;page:number;pageSize:number;webhookConfigured:boolean};
const date = (s:string) => new Date(s).toLocaleString("th-TH",{timeZone:"Asia/Bangkok",dateStyle:"short",timeStyle:"short"});
export function EmailHistoryPanel() {
  const [data,setData] = useState<Result|null>(null);
  const [page,setPage] = useState(1);
  const [status,setStatus] = useState("");
  const [category,setCategory] = useState("");
  const [search,setSearch] = useState("");
  const [query,setQuery] = useState("");
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState<string|null>(null);
  const seq = useRef(0);
  useEffect(()=>{const t=setTimeout(()=>setQuery(search),300);return ()=>clearTimeout(t)},[search]);
  const load = useCallback(async()=>{
    const id=++seq.current;setLoading(true);
    try {
      const params=new URLSearchParams({page:String(page)});
      if(status)params.set("status",status);
      if(category)params.set("category",category);
      if(query)params.set("search",query);
      const result=await adminFetch<Result>(`/api/admin/email-history?${params}`);
      if(id!==seq.current)return;
      setData(result);setPage(result.page);setError(null);
    }catch(e){if(id===seq.current)setError(e instanceof Error?e.message:"โหลดไม่สำเร็จ");}
    finally{if(id===seq.current)setLoading(false);}
  },[page,status,category,query]);
  useEffect(()=>{
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  },[load]);
  const pages=Math.max(1,Math.ceil((data?.total??0)/25));
  return <AdminPage>
    <PageHeader title="ประวัติส่งอีเมล" description="ติดตามอีเมลระบบและอีเมลวันดีประจำสัปดาห์"/>
    <InfoBox>ส่งออกแล้ว = Resend รับคำขอ · Delivered = เซิร์ฟเวอร์อีเมลปลายทางรับแล้ว ยังไม่ยืนยันว่าเข้า Inbox หรืออ่านแล้ว · Bounced = ปลายทางปฏิเสธอีเมล ประวัติเริ่มเก็บหลังเปิดใช้ฟีเจอร์นี้</InfoBox>
    {data&&!data.webhookConfigured&&<p role="status" className="mb-4 rounded-xl border border-[var(--primary)] p-4 text-sm text-[var(--primary)]">ยังไม่ได้เชื่อม webhook ของ Resend — สถานะ Delivered/Bounced จะยังไม่อัปเดต</p>}
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <TextInput aria-label="ค้นหาอีเมล" placeholder="ผู้รับ หัวข้อ หรือรหัส Resend…" className="max-w-xs" maxLength={120} value={search} onChange={e=>{setSearch(e.target.value);setPage(1)}}/>
      <Select aria-label="สถานะอีเมล" className="max-w-[240px]" value={status} onChange={e=>{setStatus(e.target.value);setPage(1)}}><option value="">ทุกสถานะ</option>{Object.entries(labels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</Select>
      <Select aria-label="ประเภทอีเมล" className="max-w-[200px]" value={category} onChange={e=>{setCategory(e.target.value);setPage(1)}}><option value="">ทุกประเภท</option><option value="WEEKLY_DAYS">วันดีประจำสัปดาห์</option><option value="SYSTEM">อีเมลระบบ</option></Select>
      <Button variant="ghost" onClick={()=>void load()} disabled={loading}>รีเฟรช</Button>
    </div>
    {error&&<p role="alert" className="mb-3 text-[var(--danger)]">{error}</p>}
    {loading&&!data?<TableSkeleton/>:<TableShell><thead><tr>{["ส่งเมื่อ","ผู้รับ / หัวข้อ","ประเภท","สถานะ","อัปเดตล่าสุด / รหัส Resend"].map(t=><Th key={t}>{t}</Th>)}</tr></thead><tbody>
      {data?.items.map(r=><tr key={r.id}><Td className="whitespace-nowrap text-xs">{date(r.createdAt)}</Td><Td><div className="w-64 max-w-64"><p className="truncate" title={r.recipient}>{r.recipient}</p><p className="truncate text-xs text-[var(--muted)]" title={r.subject}>{r.subject}</p></div></Td><Td className="whitespace-nowrap">{r.category==="WEEKLY_DAYS"?"วันดีประจำสัปดาห์":"ระบบ"}</Td><Td><Badge tone={r.status==="DELIVERED"?"green":["BOUNCED","FAILED","COMPLAINED"].includes(r.status)?"red":"muted"}>{labels[r.status]??r.status}</Badge>{r.error&&<p className="mt-1 max-w-64 break-words text-xs text-[var(--danger)]">{r.error}</p>}</Td><Td className="text-xs"><p>{date(r.statusAt)}</p><p className="max-w-64 break-all text-[var(--muted)]">{r.providerId??"—"}</p></Td></tr>)}
      {data?.items.length===0&&<tr><Td colSpan={5} className="py-8 text-center">ยังไม่มีประวัติที่ตรงกับตัวกรอง</Td></tr>}
    </tbody></TableShell>}
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--muted)]"><span>ทั้งหมด {data?.total??0} รายการ</span><div className="flex flex-wrap items-center gap-2"><Button variant="ghost" disabled={loading||page<=1} onClick={()=>setPage(page-1)}>ก่อนหน้า</Button><PageJump key={`${page}-${pages}`} page={page} totalPages={pages} disabled={loading} onPage={setPage}/><Button variant="ghost" disabled={loading||page>=pages} onClick={()=>setPage(page+1)}>ถัดไป</Button></div></div>
  </AdminPage>;
}
