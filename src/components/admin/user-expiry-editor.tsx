"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {Button,Card,Field,Select,TextInput,adminFetch} from "./ui";
import {ConfirmModal} from "@/components/app/confirm-modal";
import {subscriptionExpiryPayload} from "@/lib/pro-expiry";
type State={revision:string;canEdit:boolean;expiresAt:string|null};
export function UserExpiryEditor({userId,onSaved}:{userId:string;onSaved:()=>Promise<void>}){
 const [state,setState]=useState<State|null>(null),[mode,setMode]=useState<"date"|"forever">("date"),[day,setDay]=useState(""),[reason,setReason]=useState("");
 const [busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),[saved,setSaved]=useState(false),[confirm,setConfirm]=useState(false);
 const reasonRef=useRef<HTMLInputElement>(null),dayRef=useRef<HTMLInputElement>(null);
 function requestSave(){
  if(busy||!state?.canEdit)return;
  setSaved(false);setError(null);
  if(mode==="date"){
   let expiresAt:number;
   try{expiresAt=new Date(subscriptionExpiryPayload(mode,day)!).getTime()}catch{expiresAt=NaN}
   if(!Number.isFinite(expiresAt)||expiresAt<=Date.now()){
    setError("กรุณาเลือกวันหมดอายุเป็นวันนี้หรือวันในอนาคต (ใช้งานได้ถึงสิ้นวัน เวลาไทย)");dayRef.current?.focus();return;
   }
  }
  if(reason.trim().length<3||reason.trim().length>300){
   setError("กรุณาระบุเหตุผลการแก้วันหมดอายุ 3–300 ตัวอักษรก่อนบันทึก");reasonRef.current?.focus();return;
  }
  setConfirm(true);
 }
 const load=useCallback(async()=>{try{const s=await adminFetch<State>(`/api/admin/users/${userId}/expiry`);setState(s);setMode(s.expiresAt?"date":"forever");setDay(s.expiresAt?new Date(s.expiresAt).toLocaleDateString("en-CA",{timeZone:"Asia/Bangkok"}):"");setError(null);}catch(e){setError(e instanceof Error?e.message:"โหลดวันหมดอายุไม่สำเร็จ")}},[userId]);
 useEffect(()=>{
 // eslint-disable-next-line react-hooks/set-state-in-effect
 void load();
 },[load]);
 async function save(){if(!state)return;setBusy(true);setSaved(false);try{await adminFetch(`/api/admin/users/${userId}/expiry`,{method:"PATCH",body:JSON.stringify({expiresAt:subscriptionExpiryPayload(mode,day),reason:reason.trim(),revision:state.revision})});setConfirm(false);setReason("");await load();await onSaved();setSaved(true);}catch(e){setConfirm(false);setError(e instanceof Error?e.message:"บันทึกไม่สำเร็จ")}finally{setBusy(false)}}
 return <Card>
 <h2 className="text-sm font-semibold">แก้วันหมดอายุรายคน</h2>
 <p className="mt-2 text-xs leading-5 text-[var(--muted)]">เปลี่ยนวันสิ้นสุดของสิทธิ์สมาชิกทุกหมวดและคำถามที่ซื้อ/ให้ไว้ของบัญชีนี้ให้ตรงกัน จำนวนคำถามคงเหลือไม่เปลี่ยน และไม่เติมแพ็กเพิ่ม</p>
 <p className="mt-2 text-xs">ปัจจุบัน: {state?(state.expiresAt?new Date(state.expiresAt).toLocaleDateString("th-TH",{timeZone:"Asia/Bangkok"}):"ไม่มีวันหมดอายุ"):"กำลังโหลด…"}</p>
 {state&&!state.canEdit&&<p className="mt-2 text-xs text-[var(--muted)]">บัญชีนี้ไม่มีสิทธิ์สมาชิกหรือคำถามที่ซื้อ/ให้ไว้ให้แก้วันหมดอายุ</p>}
 <form noValidate className="mt-3 space-y-3" onSubmit={e=>{e.preventDefault();requestSave()}}>
 <Field label="ระยะเวลาใช้งาน"><Select aria-label="ระยะเวลาใช้งานรายคน" value={mode} disabled={busy||!state?.canEdit} onChange={e=>setMode(e.target.value as typeof mode)}><option value="date">กำหนดวันหมดอายุ</option><option value="forever">ไม่มีวันหมดอายุ</option></Select></Field>
 {mode==="date"&&<Field label="วันหมดอายุใหม่" hint="ใช้งานได้ถึงสิ้นวันนั้น เวลาไทย"><TextInput ref={dayRef} aria-label="วันหมดอายุใหม่" type="date" required value={day} disabled={busy||!state?.canEdit} onChange={e=>{setDay(e.target.value);setError(null);setSaved(false)}}/></Field>}
 <Field label="เหตุผลการแก้วันหมดอายุ (จำเป็น)" hint="กรอกอย่างน้อย 3 ตัวอักษร เพื่อบันทึกประวัติว่าแก้ไขเพราะอะไร"><TextInput ref={reasonRef} aria-label="เหตุผลการแก้วันหมดอายุ" required minLength={3} maxLength={300} value={reason} disabled={busy||!state?.canEdit} onChange={e=>{setReason(e.target.value);setError(null);setSaved(false)}} placeholder="เช่น กำหนดวันสิ้นสุดบัญชีทดลองใช้"/></Field>
 {error&&<p role="alert" className="text-sm text-[var(--danger)]">{error}</p>}{saved&&<p role="status" className="text-sm text-[var(--primary)]">บันทึกวันหมดอายุแล้ว โดยไม่เติมคำถามเพิ่ม</p>}
 <div className="flex flex-wrap gap-2"><Button type="submit" disabled={busy||!state?.canEdit}>บันทึกวันหมดอายุ</Button><Button type="button" variant="ghost" disabled={busy} onClick={()=>void load()}>โหลดวันหมดอายุใหม่</Button></div>
 </form>
 <ConfirmModal open={confirm} busy={busy} title="ยืนยันแก้วันหมดอายุ?" message={`${mode==="forever"?"ไม่มีวันหมดอายุ":`ใช้ได้ถึงสิ้นวันที่ ${day} เวลาไทย`} · ใช้กับสิทธิ์สมาชิกทุกหมวดและคำถามที่ซื้อ/ให้ไว้ของบัญชีนี้ โดยไม่เพิ่มหรือลดจำนวนคำถามคงเหลือ`} confirmLabel="บันทึกวันหมดอายุ" onConfirm={()=>void save()} onCancel={()=>setConfirm(false)}/>
 </Card>;
}
