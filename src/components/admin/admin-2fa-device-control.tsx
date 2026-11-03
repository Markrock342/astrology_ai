"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmModal } from "@/components/app/confirm-modal";
import { adminFetch } from "./ui";

export function Admin2faDeviceControl(){
  const router=useRouter();
  const [confirm,setConfirm]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null);
  async function forget(){
    setBusy(true);setError(null);
    try{
      await adminFetch("/api/admin/2fa",{method:"POST",body:JSON.stringify({action:"forget"})});
      router.replace("/admin-2fa/verify");router.refresh();
    }catch(e){setError(e instanceof Error?e.message:"ลืมอุปกรณ์ไม่สำเร็จ");setBusy(false);setConfirm(false)}
  }
  return <div className="shrink-0">
    <button type="button" onClick={()=>setConfirm(true)} disabled={busy} className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-50">ลืมอุปกรณ์ 2FA</button>
    {error&&<p role="alert" className="mt-1 text-xs text-[var(--danger)]">{error}</p>}
    <ConfirmModal open={confirm} busy={busy} title="ลืมอุปกรณ์นี้?" message="ยกเลิกการจดจำ 2FA บนเบราว์เซอร์นี้ แล้วกลับไปกรอกรหัสยืนยันใหม่ บัญชียังล็อกอินอยู่" confirmLabel="ลืมอุปกรณ์นี้" onConfirm={()=>void forget()} onCancel={()=>setConfirm(false)}/>
  </div>;
}
