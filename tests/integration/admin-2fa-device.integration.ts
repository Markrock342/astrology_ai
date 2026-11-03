import {afterAll,beforeAll,beforeEach,describe,expect,it,vi} from "vitest";
import {PrismaClient} from "@prisma/client";
import {createHash} from "node:crypto";
import bcrypt from "bcryptjs";
import * as OTPAuth from "otpauth";

const url=new URL(process.env.DATABASE_URL??"postgresql://invalid/invalid");
if(!["127.0.0.1","localhost"].includes(url.hostname)||!/^\/hora_admin_filter_test(?:_[a-zA-Z0-9_-]+)?$/.test(url.pathname)
  ||[...url.searchParams.keys()].some(k=>!["schema","connection_limit","pool_timeout"].includes(k)))throw new Error("Requires isolated local hora_admin_filter_test DB");
const db=new PrismaClient({datasources:{db:{url:url.href}}});
const m=vi.hoisted(()=>({values:new Map<string,string>(),writes:[] as Array<{name:string;value:string;options:{maxAge?:number;httpOnly?:boolean}}>}));
vi.mock("@/server/db",()=>({get prisma(){return db}}));
vi.mock("next/headers",()=>({cookies:async()=>({
  get:(name:string)=>m.values.has(name)?{value:m.values.get(name)}:undefined,
  set:(name:string,value:string,options:{maxAge?:number;httpOnly?:boolean})=>{m.values.set(name,value);m.writes.push({name,value,options})},
  delete:(name:string)=>m.values.delete(name),
})}));
const {getAdmin2faStatus,verifyTotpLogin,forgetAdmin2faDevice,resetAdminTotp}=await import("@/server/auth/admin-2fa-service");
const {encryptSecret,isEncryptionConfigured}=await import("@/lib/crypto/secret-box");
const {ADMIN_2FA_COOKIE,ADMIN_2FA_DEVICE_COOKIE}=await import("@/server/auth/admin-2fa-cookie");
const now=Date.UTC(2026,10,3,6),prefix="2fa-device-integration-",a=prefix+"a",b=prefix+"b";
const otpSecret=new OTPAuth.Secret({size:20});
const totp=new OTPAuth.TOTP({algorithm:"SHA1",digits:6,period:30,secret:otpSecret});
const key=createHash("sha256").update(`totp:${process.env.AUTH_SECRET?.trim()}`).digest("base64");
const encrypted=isEncryptionConfigured()?encryptSecret(otpSecret.base32):encryptSecret(otpSecret.base32,key);
const code=()=>totp.generate({timestamp:now});
beforeAll(async()=>{
  for(const id of [a,b])await db.user.create({data:{id,email:`${id}@example.invalid`,role:"ADMIN",status:"ACTIVE",passwordHash:"test-hash",totpSecretEnc:encrypted,totpEnabledAt:new Date(now-1000)}});
});
beforeEach(async()=>{
  vi.restoreAllMocks();vi.spyOn(Date,"now").mockReturnValue(now);m.values.clear();m.writes.length=0;
  await db.user.update({where:{id:a},data:{passwordHash:"test-hash",role:"ADMIN",status:"ACTIVE",totpSecretEnc:encrypted,totpEnabledAt:new Date(now-1000),totpLastStep:null,totpBackupCodesJson:[]}});
});
afterAll(async()=>{
  vi.restoreAllMocks();await db.adminAuditLog.deleteMany({where:{adminUserId:{in:[a,b]}}});
  await db.user.deleteMany({where:{id:{in:[a,b]}}});await db.$disconnect();
});
describe("real PostgreSQL admin 2FA remembered device",()=>{
  it("survives logout/re-entry for the same account without extending its fixed 30-day deadline; password reset invalidates",async()=>{
    await verifyTotpLogin(a,code(),true);
    const deadline=new Date(now+30*86400000).toISOString();
    expect(await getAdmin2faStatus(a)).toMatchObject({verified:true,rememberedUntil:deadline});
    expect(m.writes.find(w=>w.name===ADMIN_2FA_DEVICE_COOKIE)?.options).toMatchObject({httpOnly:true,maxAge:30*86400});
    m.values.delete(ADMIN_2FA_COOKIE);m.writes.length=0;
    vi.spyOn(Date,"now").mockReturnValue(now+5*86400000);
    expect(await getAdmin2faStatus(a)).toMatchObject({verified:true,rememberedUntil:deadline});expect(m.writes).toHaveLength(0);
    await db.user.update({where:{id:a},data:{passwordHash:"changed-hash"}});
    expect(await getAdmin2faStatus(a)).toMatchObject({verified:false,rememberedDevice:false});
  });
  it("rejects another admin and rejects at the exact 30-day expiry",async()=>{
    await verifyTotpLogin(a,code(),true);m.values.delete(ADMIN_2FA_COOKIE);
    expect(await getAdmin2faStatus(b)).toMatchObject({verified:false});
    vi.spyOn(Date,"now").mockReturnValue(now+30*86400000);
    expect(await getAdmin2faStatus(a)).toMatchObject({verified:false,rememberedDevice:false});
  });
  it("reset and re-enrollment cannot resurrect the old proof, and reset is audited",async()=>{
    await verifyTotpLogin(a,code(),true);
    await resetAdminTotp(a,{id:b});
    expect(await getAdmin2faStatus(a)).toMatchObject({enrolled:false,verified:false});
    await db.user.update({where:{id:a},data:{totpSecretEnc:encrypted,totpEnabledAt:new Date(now+1)}});
    expect(await getAdmin2faStatus(a)).toMatchObject({enrolled:true,verified:false});
    expect(await db.adminAuditLog.count({where:{entityId:a,action:"admin.2fa.reset"}})).toBe(1);
  });
  it("only one concurrent redemption of the same TOTP issues a proof",async()=>{
    const results=await Promise.allSettled([verifyTotpLogin(a,code(),true),verifyTotpLogin(a,code(),true)]);
    expect(results.filter(r=>r.status==="fulfilled")).toHaveLength(1);
    expect(m.writes.filter(w=>w.name===ADMIN_2FA_DEVICE_COOKIE)).toHaveLength(1);
  });
  it("a backup code is single-use even under concurrent requests",async()=>{
    await db.user.update({where:{id:a},data:{totpBackupCodesJson:[await bcrypt.hash("deadbeef",4)]}});
    const results=await Promise.allSettled([verifyTotpLogin(a,"deadbeef",true),verifyTotpLogin(a,"deadbeef",true)]);
    expect(results.filter(r=>r.status==="fulfilled")).toHaveLength(1);
    expect(m.writes.filter(w=>w.name===ADMIN_2FA_DEVICE_COOKIE)).toHaveLength(1);
    expect((await db.user.findUniqueOrThrow({where:{id:a}})).totpBackupCodesJson).toEqual([]);
  });
  it("forget clears this browser's proofs; opt-out keeps only short verification",async()=>{
    await verifyTotpLogin(a,code(),true);await forgetAdmin2faDevice();
    expect(await getAdmin2faStatus(a)).toMatchObject({verified:false,rememberedDevice:false});
    await db.user.update({where:{id:a},data:{totpLastStep:null}});
    await verifyTotpLogin(a,code());expect(m.values.has(ADMIN_2FA_DEVICE_COOKIE)).toBe(false);
    vi.spyOn(Date,"now").mockReturnValue(now+12*3600000);
    expect(await getAdmin2faStatus(a)).toMatchObject({verified:false});
  });
});
