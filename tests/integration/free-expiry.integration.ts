import {afterAll,beforeAll,describe,expect,it,vi} from "vitest";
import {PrismaClient} from "@prisma/client";
const url=new URL(process.env.DATABASE_URL??"postgresql://invalid/invalid");
if(!["localhost","127.0.0.1"].includes(url.hostname)||!/^\/hora_admin_filter_test(?:_[a-zA-Z0-9_-]+)?$/.test(url.pathname)||[...url.searchParams.keys()].some(k=>!["schema","connection_limit","pool_timeout"].includes(k)))throw new Error("Isolated local test DB required");
const db=new PrismaClient({datasources:{db:{url:url.href}}});
vi.mock("@/server/db",()=>({get prisma(){return db}}));
const {getUserExpiry,setUserExpiry}=await import("@/server/admin/user-expiry-service");
const {lapseExpiredIncludedUsage,expirePurchasedUsage}=await import("@/server/usage/usage-budget-service");
const prefix="free-expiry-regression-",admin=prefix+"admin",now=new Date(),until=new Date(now.getTime()+2*86400000);
let freeId:string,proId:string;
async function fixture(name:string,balance=30000,withWallet=true,withFree=true){
  const id=prefix+name;
  await db.user.create({data:{id,email:`${id}@example.invalid`,...(withWallet?{usageWallet:{create:{includedBalanceUnits:balance,includedAllowanceUnits:75000,purchasedBalanceUnits:0}}}:{}),...(withFree?{subscriptions:{create:{packageId:freeId,status:"ACTIVE",expiresAt:null}}}:{})}});
  return id;
}
async function save(id:string,expiresAt:Date|null,actor=admin){
  const state=await getUserExpiry(id);expect(state.canEdit).toBe(true);expect(state.scope).toBe("FREE");
  return setUserExpiry(id,{expiresAt,reason:"Free trial deadline regression",revision:state.revision},{id:actor});
}
beforeAll(async()=>{
  freeId=(await db.package.upsert({where:{code:"FREE"},create:{code:"FREE",name:"Free",type:"FREE",usageBudgetUnits:75000},update:{usageBudgetUnits:75000}})).id;
  proId=(await db.package.create({data:{code:prefix+"PRO",name:"Historical paid",type:"PRO"}})).id;
  await db.user.create({data:{id:admin,email:`${admin}@example.invalid`,role:"ADMIN"}});
});
afterAll(async()=>{
  await db.adminAuditLog.deleteMany({where:{adminUserId:admin}});
  await db.user.deleteMany({where:{id:{startsWith:prefix}}});
  await db.package.deleteMany({where:{id:proId}});await db.$disconnect();
});
describe("Free-only account expiry (the reported production case)",()=>{
  it("enables Free with only included questions, persists date/null and never changes balances or creates Pro",async()=>{
    const id=await fixture("included-only");
    expect(await getUserExpiry(id)).toMatchObject({canEdit:true,scope:"FREE",expiresAt:null});
    const before=await db.usageWallet.findUniqueOrThrow({where:{userId:id}});
    for(const expiresAt of [until,null]){
      await save(id,expiresAt);
      expect((await getUserExpiry(id)).expiresAt).toEqual(expiresAt);
      const after=await db.usageWallet.findUniqueOrThrow({where:{userId:id}});
      for(const key of ["includedBalanceUnits","includedAllowanceUnits","purchasedBalanceUnits","purchasedAllowanceUnits"] as const)expect(after[key]).toBe(before[key]);
      expect(after.periodEndsAt).toEqual(expiresAt);
      expect((await db.userSubscription.findFirstOrThrow({where:{userId:id}})).expiresAt).toEqual(expiresAt);
      expect(await db.userSubscription.count({where:{userId:id,package:{type:"PRO"}}})).toBe(0);
    }
    expect(await db.usageTransaction.count({where:{userId:id}})).toBe(0);
    expect(await db.adminAuditLog.count({where:{entityId:id,action:"user.expiry.set"}})).toBe(2);
  });
  it("allows date changes even when Free questions are zero, without refilling them",async()=>{
    const id=await fixture("zero-balance",0);await save(id,until);await save(id,null);
    expect((await db.usageWallet.findUniqueOrThrow({where:{userId:id}})).includedBalanceUnits).toBe(0);
    expect(await db.usageTransaction.count({where:{userId:id}})).toBe(0);
  });
  it("does not reactivate a historical expired paid subscription when the current account is Free",async()=>{
    const id=await fixture("expired-paid"),past=new Date(now.getTime()-86400000);
    const old=await db.userSubscription.create({data:{userId:id,packageId:proId,status:"ACTIVE",expiresAt:past}});
    await save(id,until);
    expect((await db.userSubscription.findUniqueOrThrow({where:{id:old.id}})).expiresAt).toEqual(past);
    expect(await db.userSubscription.count({where:{userId:id,status:"ACTIVE",package:{type:"PRO"},OR:[{expiresAt:null},{expiresAt:{gt:now}}]}})).toBe(0);
  });
  it("initializes missing Free metadata/wallet without a grant; audit failure rolls all initialization back",async()=>{
    const id=await fixture("legacy-empty",0,false,false);
    await expect(save(id,until,"missing-admin")).rejects.toThrow();
    expect(await db.usageWallet.findUnique({where:{userId:id}})).toBeNull();
    expect(await db.userSubscription.count({where:{userId:id}})).toBe(0);
    await save(id,until);
    const wallet=await db.usageWallet.findUniqueOrThrow({where:{userId:id}});
    expect(wallet.includedBalanceUnits+wallet.purchasedBalanceUnits).toBe(0);
    expect((await db.userSubscription.findFirstOrThrow({where:{userId:id},include:{package:true}})).package.type).toBe("FREE");
    expect(await db.usageTransaction.count({where:{userId:id}})).toBe(0);
  });
  it("expires the Free pool at the exact deadline without refilling, extending it into Pro or expiring a still-valid purchase",async()=>{
    const id=await fixture("boundary");await save(id,until);
    const paidUntil=new Date(until.getTime()+86400000);
    await db.usageWallet.update({where:{userId:id},data:{purchasedBalanceUnits:60000,purchasedAllowanceUnits:60000,purchasedExpiresAt:paidUntil}});
    await db.userSubscription.create({data:{userId:id,packageId:proId,status:"ACTIVE",expiresAt:paidUntil}});
    await lapseExpiredIncludedUsage(id,db,new Date(until.getTime()-1));
    expect((await db.usageWallet.findUniqueOrThrow({where:{userId:id}})).includedBalanceUnits).toBe(30000);
    await lapseExpiredIncludedUsage(id,db,until);await expirePurchasedUsage(id,db,until);
    let wallet=await db.usageWallet.findUniqueOrThrow({where:{userId:id}});
    expect(wallet.includedBalanceUnits).toBe(0);expect(wallet.includedAllowanceUnits).toBe(0);expect(wallet.purchasedBalanceUnits).toBe(60000);
    await lapseExpiredIncludedUsage(id,db,until);
    expect(await db.usageTransaction.count({where:{userId:id,referenceType:"free_period_end"}})).toBe(1);
    await expirePurchasedUsage(id,db,paidUntil);
    wallet=await db.usageWallet.findUniqueOrThrow({where:{userId:id}});expect(wallet.purchasedBalanceUnits).toBe(0);
  });
  it("default Free remains open-ended beyond 30 days, and clearing a chosen date cancels its cutoff",async()=>{
    const id=await fixture("forever");await save(id,until);await save(id,null);
    await lapseExpiredIncludedUsage(id,db,new Date(now.getTime()+31*86400000));
    expect((await db.usageWallet.findUniqueOrThrow({where:{userId:id}})).includedBalanceUnits).toBe(30000);
    expect(await getUserExpiry(id)).toMatchObject({expiresAt:null,canEdit:true,scope:"FREE"});
  });
});
