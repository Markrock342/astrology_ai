import {afterAll,beforeAll,describe,expect,it,vi} from "vitest";
import {PrismaClient} from "@prisma/client";
const url=new URL(process.env.DATABASE_URL??"postgresql://invalid/invalid");
if(!["localhost","127.0.0.1"].includes(url.hostname)||!/^\/hora_admin_filter_test(?:_[a-zA-Z0-9_-]+)?$/.test(url.pathname)||[...url.searchParams.keys()].some(k=>!["schema","connection_limit","pool_timeout"].includes(k)))throw new Error("Isolated local test DB required");
const db=new PrismaClient({datasources:{db:{url:url.href}}});
vi.mock("@/server/db",()=>({get prisma(){return db}}));
const {provisionUser,ensureOAuthUser}=await import("@/server/auth/provisioning");
const {lapseExpiredIncludedUsage}=await import("@/server/usage/usage-budget-service");
const prefix="free-signup-default-";let freeId:string;
async function days(value:number|null){await db.package.update({where:{id:freeId},data:{expiryMode:value===null?"NONE":"DAYS",expiryDays:value,expiresOn:null}})}
async function state(id:string){return {wallet:await db.usageWallet.findUniqueOrThrow({where:{userId:id}}),sub:await db.userSubscription.findFirstOrThrow({where:{userId:id,packageId:freeId}})}}
beforeAll(async()=>{freeId=(await db.package.upsert({where:{code:"FREE"},create:{code:"FREE",name:"Free",type:"FREE",usageBudgetUnits:75000,creditQuota:5},update:{usageBudgetUnits:75000,creditQuota:5,expiryMode:"NONE",expiryDays:null,expiresOn:null}})).id});
afterAll(async()=>{await db.user.deleteMany({where:{email:{startsWith:prefix}}});await db.package.update({where:{id:freeId},data:{expiryMode:"NONE",expiryDays:null,expiresOn:null,usageBudgetUnits:75000}});await db.$disconnect()});
describe("new Free accounts follow package configuration only at signup",()=>{
  it("email signup persists a 30-day Free subscription and wallet, with one normal quota grant",async()=>{
    await days(30);const user=await provisionUser({email:prefix+"email@example.invalid",passwordHash:"fixture-hash"});
    const s=await state(user.id),expected=new Date(user.createdAt.getTime()+30*86400000);
    expect(s.sub.expiresAt).toEqual(expected);expect(s.wallet.periodEndsAt).toEqual(expected);
    expect(s.wallet.includedBalanceUnits).toBe(75000);expect(s.wallet.purchasedBalanceUnits).toBe(0);
    expect(await db.userSubscription.count({where:{userId:user.id,package:{type:"PRO"}}})).toBe(0);
    expect(await db.usageTransaction.count({where:{userId:user.id,type:"INITIAL_GRANT"}})).toBe(1);
  });
  it("Google provisioning uses the same 30-day rule; logging in again never renews or refills it",async()=>{
    await days(30);const email=prefix+"google@example.invalid";await ensureOAuthUser({email,name:"Google Test"});
    const user=await db.user.findUniqueOrThrow({where:{email}}),before=await state(user.id);
    expect(before.sub.expiresAt?.getTime()).toBe(user.createdAt.getTime()+30*86400000);
    await days(60);await ensureOAuthUser({email,name:"Google Test"});
    expect(await state(user.id)).toEqual(before);
  });
  it("changing the default only affects future signups, preserving existing dated and indefinite accounts",async()=>{
    await days(null);const old=await provisionUser({email:prefix+"old@example.invalid",emailVerified:true});const before=await state(old.id);
    await days(30);const first=await provisionUser({email:prefix+"30@example.invalid",emailVerified:true});const firstState=await state(first.id);
    await days(60);const next=await provisionUser({email:prefix+"60@example.invalid",emailVerified:true});
    expect((await state(next.id)).sub.expiresAt?.getTime()).toBe(next.createdAt.getTime()+60*86400000);
    expect(await state(first.id)).toEqual(firstState);expect(await state(old.id)).toEqual(before);
  });
  it("NONE and legacy DEFAULT remain indefinite",async()=>{
    for(const mode of ["NONE","DEFAULT"] as const){
      await db.package.update({where:{id:freeId},data:{expiryMode:mode,expiryDays:null}});
      const user=await provisionUser({email:prefix+mode+"@example.invalid"});const s=await state(user.id);
      expect(s.sub.expiresAt).toBeNull();expect(s.wallet.periodEndsAt).toBeNull();
    }
  });
  it("a zero-question package still stores its signup deadline",async()=>{
    await days(30);await db.package.update({where:{id:freeId},data:{usageBudgetUnits:0}});
    const user=await provisionUser({email:prefix+"zero@example.invalid"});const s=await state(user.id);
    expect(s.wallet.periodEndsAt).toEqual(s.sub.expiresAt);expect(s.wallet.includedBalanceUnits).toBe(0);
    await db.package.update({where:{id:freeId},data:{usageBudgetUnits:75000}});
  });
  it("the actual signup pool expires at its exact deadline without a fresh Free allowance",async()=>{
    await days(30);const user=await provisionUser({email:prefix+"boundary@example.invalid"});const s=await state(user.id);
    await lapseExpiredIncludedUsage(user.id,db,new Date(s.sub.expiresAt!.getTime()-1));expect((await state(user.id)).wallet.includedBalanceUnits).toBe(75000);
    await lapseExpiredIncludedUsage(user.id,db,s.sub.expiresAt!);expect((await state(user.id)).wallet.includedBalanceUnits).toBe(0);
  });
  it("ending an earlier paid period retains the stored Free signup deadline, not the current package default",async()=>{
    await days(30);const user=await provisionUser({email:prefix+"paid-fallback@example.invalid"});const s=await state(user.id),past=new Date(user.createdAt.getTime()+86400000);
    await db.usageWallet.update({where:{userId:user.id},data:{periodEndsAt:past,includedBalanceUnits:900000}});
    await days(60);await lapseExpiredIncludedUsage(user.id,db,past);
    const after=await state(user.id);expect(after.wallet.periodEndsAt).toEqual(s.sub.expiresAt);expect(after.wallet.includedBalanceUnits).toBe(75000);
    await lapseExpiredIncludedUsage(user.id,db,s.sub.expiresAt!);expect((await state(user.id)).wallet.includedBalanceUnits).toBe(0);
  });
});
