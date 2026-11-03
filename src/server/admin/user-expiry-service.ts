import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/server/db";
import { AppError } from "@/lib/errors";
import { lockUsageWalletForUpdate } from "@/server/usage/usage-budget-service";
import { writeAudit } from "@/server/audit/audit-service";
import { invalidateUserBootstrap } from "@/server/app/bootstrap-cache";

export const userExpirySchema = z.object({
  expiresAt: z.union([z.iso.datetime({offset:true}).transform(s=>new Date(s)),z.null()]),
  reason: z.string().trim().min(3,"กรุณาระบุเหตุผลอย่างน้อย 3 ตัวอักษร").max(300),
  revision: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();
async function snapshot(tx: Prisma.TransactionClient,userId:string) {
  const user=await tx.user.findUnique({where:{id:userId},select:{id:true}});
  if(!user)throw new AppError("NOT_FOUND","ไม่พบผู้ใช้");
  const wallet=await tx.usageWallet.findUnique({where:{userId},select:{version:true,includedBalanceUnits:true,purchasedBalanceUnits:true,periodEndsAt:true,purchasedExpiresAt:true}});
  const subscriptions=await tx.userSubscription.findMany({where:{userId,status:"ACTIVE"},select:{id:true,expiresAt:true,package:{select:{type:true}}},orderBy:{id:"asc"}});
  return {wallet,subscriptions};
}
type Snapshot=Awaited<ReturnType<typeof snapshot>>;
export function expiryRevision(state:Snapshot) {return createHash("sha256").update(JSON.stringify(state)).digest("hex");}
function livePro(state:Snapshot,now:Date){
  return state.subscriptions.filter(s=>s.package.type==="PRO"&&(!s.expiresAt||s.expiresAt>now));
}
export async function getUserExpiry(userId:string) {
  return prisma.$transaction(async tx=>{
    const state=await snapshot(tx,userId);
    const pro=livePro(state,new Date());
    const relevant=pro.length?pro:state.subscriptions.filter(s=>s.package.type==="FREE");
    const hasPurchased=(state.wallet?.purchasedBalanceUnits??0)>0;
    return {revision:expiryRevision(state),canEdit:true,
      scope:pro.length?"PRO" as const:"FREE" as const,
      expiresAt:hasPurchased?state.wallet!.purchasedExpiresAt:relevant.some(s=>s.expiresAt===null)?null:relevant[0]?.expiresAt??null};
  },{isolationLevel:"RepeatableRead"});
}
export async function setUserExpiry(userId:string,input:z.infer<typeof userExpirySchema>,actor:{id:string;ip?:string}) {
  if(input.expiresAt&&input.expiresAt.getTime()<=Date.now())throw new AppError("VALIDATION","วันหมดอายุต้องเป็นวันในอนาคต");
  const result=await prisma.$transaction(async tx=>{
    const initial=await snapshot(tx,userId);
    if(expiryRevision(initial)!==input.revision)throw new AppError("VALIDATION","ข้อมูลผู้ใช้เปลี่ยนแล้ว กรุณาโหลดวันหมดอายุใหม่ก่อนบันทึก");
    // Serialize with purchases/usage. A legacy account may need an empty wallet;
    // creating that wallet must not turn its unchanged revision into a conflict.
    await lockUsageWalletForUpdate(userId,tx);
    const before=await snapshot(tx,userId);
    const w=before.wallet;
    const justInitialized=initial.wallet===null&&w?.version===0&&w.includedBalanceUnits===0&&w.purchasedBalanceUnits===0&&w.periodEndsAt===null&&w.purchasedExpiresAt===null;
    const comparable=justInitialized?{...before,wallet:null}:before;
    if(expiryRevision(comparable)!==input.revision)throw new AppError("VALIDATION","ข้อมูลผู้ใช้เปลี่ยนแล้ว กรุณาโหลดวันหมดอายุใหม่ก่อนบันทึก");
    const pro=livePro(before,new Date());
    const free=before.subscriptions.filter(s=>s.package.type==="FREE");
    // Never revive an expired paid plan by changing the dates of a Free user.
    const ids=[...pro,...free].map(s=>s.id);
    await tx.userSubscription.updateMany({where:{id:{in:ids},userId,status:"ACTIVE"},data:{expiresAt:input.expiresAt}});
    if(!pro.length&&!free.length){
      const pkg=await tx.package.findUnique({where:{code:"FREE"},select:{id:true}});
      if(!pkg)throw new AppError("VALIDATION","ไม่พบแพ็กเกจ Free สำหรับบันทึกวันหมดอายุ");
      // Metadata only: no grant, payment, Pro entitlement or quota reset.
      await tx.userSubscription.create({data:{userId,packageId:pkg.id,status:"ACTIVE",activationSource:"ADMIN_MANUAL",expiresAt:input.expiresAt}});
    }
    const hasPurchased=(before.wallet?.purchasedBalanceUnits??0)>0;
    await tx.usageWallet.update({where:{userId},data:{
      periodEndsAt:input.expiresAt,
      ...(hasPurchased?{purchasedExpiresAt:input.expiresAt}:{}),version:{increment:1},
    }});
    const after=await snapshot(tx,userId);
    await writeAudit({adminUserId:actor.id,action:"user.expiry.set",entityType:"user",entityId:userId,before:initial,after:{...after,expiresAt:input.expiresAt,reason:input.reason},ipAddress:actor.ip},tx);
    return {expiresAt:input.expiresAt};
  });
  invalidateUserBootstrap(userId);
  return result;
}
