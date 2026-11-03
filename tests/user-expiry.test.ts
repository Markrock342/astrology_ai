import {beforeEach,describe,it,expect,vi} from "vitest";
const m=vi.hoisted(()=>({user:vi.fn(),wallet:vi.fn(),subs:vi.fn(),updateWallet:vi.fn(),updateSubs:vi.fn(),createSub:vi.fn(),pkg:vi.fn(),lock:vi.fn(),audit:vi.fn(),invalidate:vi.fn()}));
vi.mock("@/server/db",()=>({prisma:{$transaction:async(fn:(tx:unknown)=>unknown)=>fn({user:{findUnique:m.user},usageWallet:{findUnique:m.wallet,update:m.updateWallet},userSubscription:{findMany:m.subs,updateMany:m.updateSubs,create:m.createSub},package:{findUnique:m.pkg}})}}));
vi.mock("@/server/usage/usage-budget-service",()=>({lockUsageWalletForUpdate:m.lock}));
vi.mock("@/server/audit/audit-service",()=>({writeAudit:m.audit}));
vi.mock("@/server/app/bootstrap-cache",()=>({invalidateUserBootstrap:m.invalidate}));
import {getUserExpiry,setUserExpiry,userExpirySchema,expiryRevision} from "@/server/admin/user-expiry-service";
const state={wallet:{version:3,includedBalanceUnits:200,purchasedBalanceUnits:4000,periodEndsAt:null,purchasedExpiresAt:null},subscriptions:[{id:"sub1",expiresAt:null,package:{type:"PRO" as const}},{id:"sub2",expiresAt:null,package:{type:"PRO" as const}}]};
beforeEach(()=>{vi.resetAllMocks();m.user.mockResolvedValue({id:"u1"});m.wallet.mockResolvedValue(state.wallet);m.subs.mockResolvedValue(state.subscriptions);m.pkg.mockResolvedValue({id:"free-pkg"})});
describe("admin expiry edit",()=>{
 for(const expiry of [null,new Date("2099-12-31T16:59:59Z")])it(`changes dates only (${expiry}) and audits without granting a pack`,async()=>{
  await setUserExpiry("u1",{expiresAt:expiry,reason:"End trial",revision:expiryRevision(state)},{id:"admin"});
  expect(m.updateWallet).toHaveBeenCalledWith({where:{userId:"u1"},data:{periodEndsAt:expiry,purchasedExpiresAt:expiry,version:{increment:1}}});
  expect(m.updateSubs).toHaveBeenCalledWith(expect.objectContaining({where:{id:{in:["sub1","sub2"]},userId:"u1",status:"ACTIVE"},data:{expiresAt:expiry}}));
  expect(m.audit).toHaveBeenCalledWith(expect.objectContaining({action:"user.expiry.set",before:state,after:expect.objectContaining({reason:"End trial"})}),expect.anything());expect(m.invalidate).toHaveBeenCalledWith("u1");
 });
 it("rejects a stale form after usage/purchase changed",async()=>{
  m.wallet.mockResolvedValue({...state.wallet,version:4});await expect(setUserExpiry("u1",{expiresAt:null,reason:"Trial",revision:expiryRevision(state)},{id:"a"})).rejects.toThrow(/เปลี่ยนแล้ว/);expect(m.updateWallet).not.toHaveBeenCalled();
 });
 it("rejects past dates without changing data",async()=>{
  await expect(setUserExpiry("u1",{expiresAt:new Date("2020-01-01"),reason:"Trial",revision:expiryRevision(state)},{id:"a"})).rejects.toThrow(/อนาคต/);expect(m.updateSubs).not.toHaveBeenCalled();
 });
 it("lets a Free-only account edit expiry without granting Pro or questions",async()=>{
  m.wallet.mockResolvedValue({...state.wallet,purchasedBalanceUnits:0});m.subs.mockResolvedValue([]);const s=await getUserExpiry("u1");
  expect(s.canEdit).toBe(true);expect(s.scope).toBe("FREE");
  await setUserExpiry("u1",{expiresAt:null,reason:"Trial",revision:s.revision},{id:"a"});
  expect(m.createSub).toHaveBeenCalledWith({data:{userId:"u1",packageId:"free-pkg",status:"ACTIVE",activationSource:"ADMIN_MANUAL",expiresAt:null}});
  expect(m.updateWallet).toHaveBeenCalledWith({where:{userId:"u1"},data:{periodEndsAt:null,version:{increment:1}}});
 });
 it("does not revive an expired paid plan while editing Free",async()=>{
  const subscriptions=[{id:"old-pro",expiresAt:new Date("2020-01-01"),package:{type:"PRO" as const}},{id:"free",expiresAt:null,package:{type:"FREE"}}];
  m.subs.mockResolvedValue(subscriptions);m.wallet.mockResolvedValue({...state.wallet,purchasedBalanceUnits:0});
  const s=await getUserExpiry("u1");expect(s.scope).toBe("FREE");expect(s.expiresAt).toBeNull();
  const expiresAt=new Date("2099-01-01");await setUserExpiry("u1",{expiresAt,reason:"Trial",revision:s.revision},{id:"a"});
  expect(m.updateSubs).toHaveBeenCalledWith({where:{id:{in:["free"]},userId:"u1",status:"ACTIVE"},data:{expiresAt}});
 });
 it("validates explicit expiry and reason without accepting grant controls",()=>{
  expect(userExpirySchema.safeParse({reason:"x",revision:expiryRevision(state)}).success).toBe(false);
  expect(userExpirySchema.safeParse({expiresAt:null,reason:"Trial",revision:expiryRevision(state),grantCredits:true}).success).toBe(false);
 });
});
