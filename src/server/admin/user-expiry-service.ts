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
  const subscriptions=await tx.userSubscription.findMany({where:{userId,status:"ACTIVE",package:{type:"PRO"}},select:{id:true,expiresAt:true},orderBy:{id:"asc"}});
  return {wallet,subscriptions};
}
type Snapshot=Awaited<ReturnType<typeof snapshot>>;
export function expiryRevision(state:Snapshot) {return createHash("sha256").update(JSON.stringify(state)).digest("hex");}
export async function getUserExpiry(userId:string) {
  return prisma.$transaction(async tx=>{
    const state=await snapshot(tx,userId);
    const hasPurchased=(state.wallet?.purchasedBalanceUnits??0)>0;
    return {revision:expiryRevision(state),canEdit:state.subscriptions.length>0||hasPurchased,
      expiresAt:hasPurchased?state.wallet!.purchasedExpiresAt:state.subscriptions.some(s=>s.expiresAt===null)?null:state.subscriptions[0]?.expiresAt??null};
  },{isolationLevel:"RepeatableRead"});
}
export async function setUserExpiry(userId:string,input:z.infer<typeof userExpirySchema>,actor:{id:string;ip?:string}) {
  if(input.expiresAt&&input.expiresAt.getTime()<=Date.now())throw new AppError("VALIDATION","วันหมดอายุต้องเป็นวันในอนาคต");
  const result=await prisma.$transaction(async tx=>{
    // Same lock as purchases and usage: this operation never grants a new pack.
    const user=await tx.user.findUnique({where:{id:userId},select:{id:true}});
    if(!user)throw new AppError("NOT_FOUND","ไม่พบผู้ใช้");
    await lockUsageWalletForUpdate(userId,tx);
    const before=await snapshot(tx,userId);
    if(expiryRevision(before)!==input.revision)throw new AppError("VALIDATION","ข้อมูลผู้ใช้เปลี่ยนแล้ว กรุณาโหลดวันหมดอายุใหม่ก่อนบันทึก");
    const hasPurchased=(before.wallet?.purchasedBalanceUnits??0)>0;
    if(!before.subscriptions.length&&!hasPurchased)throw new AppError("VALIDATION","ไม่มีสิทธิ์สมาชิกหรือคำถามที่ซื้อ/ให้ไว้ให้แก้วันหมดอายุ");
    await tx.userSubscription.updateMany({where:{id:{in:before.subscriptions.map(s=>s.id)},userId,status:"ACTIVE"},data:{expiresAt:input.expiresAt}});
    await tx.usageWallet.update({where:{userId},data:{
      ...(before.subscriptions.length?{periodEndsAt:input.expiresAt}:{}),
      ...(hasPurchased?{purchasedExpiresAt:input.expiresAt}:{}),version:{increment:1},
    }});
    const after=await snapshot(tx,userId);
    await writeAudit({adminUserId:actor.id,action:"user.expiry.set",entityType:"user",entityId:userId,before,after:{...after,expiresAt:input.expiresAt,reason:input.reason},ipAddress:actor.ip},tx);
    return {expiresAt:input.expiresAt};
  });
  invalidateUserBootstrap(userId);
  return result;
}
