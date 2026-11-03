import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import * as OTPAuth from "otpauth";
import {issueAdmin2faToken,verifyAdmin2faToken,ADMIN_2FA_DEVICE_TTL_MS,type Admin2faIdentity} from "@/server/auth/admin-2fa-token";
import {ADMIN_2FA_COOKIE,ADMIN_2FA_DEVICE_COOKIE} from "@/server/auth/admin-2fa-cookie";
import {ADMIN_2FA_TTL_MS} from "@/config/constants";
const now=Date.UTC(2026,10,3,5),secret="device-test-only-secret";
const user:Admin2faIdentity={id:"admin-a",role:"ADMIN",status:"ACTIVE",passwordHash:"hash-a",totpSecretEnc:"encrypted-a",totpEnabledAt:new Date(now-1000)};
describe("credential-bound admin device proof",()=>{
  it("has a fixed 30-day expiry, accepts just before it and rejects at the exact boundary",()=>{
    const token=issueAdmin2faToken(user,"device",secret,now);
    expect(token.expiresAt-now).toBe(30*86400000);
    expect(verifyAdmin2faToken(token.value,user,"device",secret,token.expiresAt-1)).toBe(token.expiresAt);
    expect(verifyAdmin2faToken(token.value,user,"device",secret,token.expiresAt)).toBeNull();
    expect(verifyAdmin2faToken(token.value,user,"device",secret,now+86400000)).toBe(token.expiresAt);
  });
  it("keeps the short proof at 12 hours and separates session/device purposes",()=>{
    const token=issueAdmin2faToken(user,"session",secret,now);
    expect(token.expiresAt-now).toBe(ADMIN_2FA_TTL_MS);
    expect(verifyAdmin2faToken(token.value,user,"device",secret,now)).toBeNull();
    expect(verifyAdmin2faToken(issueAdmin2faToken(user,"device",secret,now).value,user,"session",secret,now)).toBeNull();
  });
  for(const [label,change] of Object.entries({
    "another account":{id:"admin-b"},"password reset":{passwordHash:"hash-b"},"2FA secret reset":{totpSecretEnc:"encrypted-b"},
    "2FA re-enrolled":{totpEnabledAt:new Date(now)},"2FA disabled":{totpEnabledAt:null},"account disabled":{status:"DISABLED"},
    "role revoked":{role:"USER"},"role changed":{role:"SUPER_ADMIN"},
  }))it(`invalidates after ${label}`,()=>{
    const token=issueAdmin2faToken(user,"device",secret,now);
    expect(verifyAdmin2faToken(token.value,{...user,...change},"device",secret,now)).toBeNull();
  });
  it("rejects tampering, old unbound cookies, future-issued tokens, wrong signing key and oversized input",()=>{
    const token=issueAdmin2faToken(user,"device",secret,now).value;
    for(const value of [undefined,"admin-a.9999999999999.signature",token+"x",token.replace(/^./,"!"),"x".repeat(3000)])expect(verifyAdmin2faToken(value,user,"device",secret,now)).toBeNull();
    expect(verifyAdmin2faToken(token,user,"device","another-key",now)).toBeNull();
    expect(verifyAdmin2faToken(token,user,"device",secret,now-1)).toBeNull();
  });
});

const m=vi.hoisted(()=>({find:vi.fn(),updateMany:vi.fn(),set:vi.fn(),del:vi.fn(),values:new Map<string,string>()}));
vi.mock("@/server/db",()=>({prisma:{user:{findUnique:m.find,updateMany:m.updateMany}}}));
vi.mock("next/headers",()=>({cookies:async()=>({get:(name:string)=>m.values.has(name)?{value:m.values.get(name)}:undefined,set:m.set,delete:m.del})}));
vi.mock("@/server/audit/audit-service",()=>({writeAudit:vi.fn()}));
vi.mock("@/lib/crypto/secret-box",()=>({isEncryptionConfigured:()=>true,encryptSecret:(s:string)=>s,decryptSecret:(s:string)=>s}));
import {forgetAdmin2faDevice,getAdmin2faStatus,verifyTotpLogin} from "@/server/auth/admin-2fa-service";
const otpSecret=new OTPAuth.Secret({size:20}),totp=new OTPAuth.TOTP({algorithm:"SHA1",digits:6,period:30,secret:otpSecret});
beforeEach(()=>{vi.clearAllMocks();m.values.clear();vi.stubEnv("AUTH_SECRET",secret);vi.spyOn(Date,"now").mockReturnValue(now);m.find.mockResolvedValue({...user,totpSecretEnc:otpSecret.base32,totpBackupCodesJson:[],totpLastStep:null});m.updateMany.mockResolvedValue({count:1})});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllEnvs()});
describe("admin 2FA service device consent",()=>{
  it("issues a persistent HttpOnly Secure cookie only after a correct OTP and explicit opt-in",async()=>{
    vi.stubEnv("NODE_ENV","production");
    await verifyTotpLogin(user.id,totp.generate({timestamp:now}),true);
    expect(m.set).toHaveBeenCalledWith(ADMIN_2FA_DEVICE_COOKIE,expect.any(String),expect.objectContaining({httpOnly:true,secure:true,sameSite:"lax",path:"/",maxAge:ADMIN_2FA_DEVICE_TTL_MS/1000}));
    expect(m.set).toHaveBeenCalledWith(ADMIN_2FA_COOKIE,expect.any(String),expect.objectContaining({maxAge:ADMIN_2FA_TTL_MS/1000}));
  });
  it("defaults to short verification and clears any previous remembered-device choice",async()=>{
    await verifyTotpLogin(user.id,totp.generate({timestamp:now}));
    expect(m.set.mock.calls.map(c=>c[0])).toEqual([ADMIN_2FA_COOKIE]);
    expect(m.del).toHaveBeenCalledWith(ADMIN_2FA_DEVICE_COOKIE);
  });
  it("never issues cookies for a wrong OTP",async()=>{
    await expect(verifyTotpLogin(user.id,"not-an-otp",true)).rejects.toMatchObject({code:"VALIDATION"});expect(m.set).not.toHaveBeenCalled();
  });
  it("accepts the remembered device after logout cleared the short proof, without renewing cookies",async()=>{
    const account={...user,totpSecretEnc:otpSecret.base32};
    m.values.set(ADMIN_2FA_DEVICE_COOKIE,issueAdmin2faToken(account,"device",secret,now).value);
    expect(await getAdmin2faStatus(user.id)).toMatchObject({verified:true,rememberedDevice:true,rememberedUntil:new Date(now+ADMIN_2FA_DEVICE_TTL_MS).toISOString()});
    expect(m.set).not.toHaveBeenCalled();
    m.find.mockResolvedValue({...account,id:"admin-b"});
    expect(await getAdmin2faStatus("admin-b")).toMatchObject({verified:false,rememberedDevice:false});
  });
  it("forgets both proofs on this browser",async()=>{
    await forgetAdmin2faDevice();expect(m.del.mock.calls.map(c=>c[0]).sort()).toEqual([ADMIN_2FA_COOKIE,ADMIN_2FA_DEVICE_COOKIE].sort());
  });
});
