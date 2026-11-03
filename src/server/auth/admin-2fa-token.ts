import { createHmac, timingSafeEqual } from "node:crypto";
import { ADMIN_2FA_TTL_MS } from "@/config/constants";

export const ADMIN_2FA_DEVICE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export type Admin2faIdentity = {
  id: string;
  role: string;
  status: string;
  passwordHash: string | null;
  totpSecretEnc: string | null;
  totpEnabledAt: Date | null;
};
type Purpose = "session" | "device";
const ttl = (purpose: Purpose) => purpose === "device" ? ADMIN_2FA_DEVICE_TTL_MS : ADMIN_2FA_TTL_MS;
function mac(value: string, secret: string) {
  if (!secret.trim()) throw new Error("AUTH_SECRET missing");
  return createHmac("sha256", secret.trim()).update(`admin-2fa:v2:${value}`).digest("base64url");
}
function equal(a: string, b: string) {
  const x=Buffer.from(a), y=Buffer.from(b);
  return x.length===y.length && timingSafeEqual(x,y);
}
function eligible(user: Admin2faIdentity) {
  return user.status === "ACTIVE" && ["ADMIN","SUPER_ADMIN"].includes(user.role)
    && Boolean(user.totpEnabledAt && user.totpSecretEnc);
}
function stamp(user: Admin2faIdentity, secret: string) {
  return mac(JSON.stringify([user.id,user.role,user.passwordHash,user.totpSecretEnc,user.totpEnabledAt?.toISOString()]),secret);
}
/** Credential-bound, purpose-separated proof. Reads never extend its lifetime. */
export function issueAdmin2faToken(user: Admin2faIdentity, purpose: Purpose, secret: string, now=Date.now()) {
  if(!eligible(user))throw new Error("Admin 2FA is not enrolled or account is inactive");
  const expiresAt=now+ttl(purpose);
  const body=Buffer.from(JSON.stringify([2,purpose,user.id,now,expiresAt,stamp(user,secret)])).toString("base64url");
  return {value:`${body}.${mac(body,secret)}`,expiresAt};
}
export function verifyAdmin2faToken(value: string | undefined,user: Admin2faIdentity,purpose: Purpose,secret: string,now=Date.now()): number | null {
  if(!value || value.length>2048 || !eligible(user))return null;
  try{
    const parts=value.split(".");
    if(parts.length!==2 || !equal(parts[1]!,mac(parts[0]!,secret)))return null;
    const data:unknown=JSON.parse(Buffer.from(parts[0]!,"base64url").toString("utf8"));
    if(!Array.isArray(data)||data.length!==6)return null;
    const [version,kind,id,issuedAt,expiresAt,credentials]=data;
    if(version!==2||kind!==purpose||id!==user.id||!Number.isSafeInteger(issuedAt)||!Number.isSafeInteger(expiresAt)
      ||issuedAt>now||expiresAt<=now||expiresAt-issuedAt!==ttl(purpose)
      ||typeof credentials!=="string"||!equal(credentials,stamp(user,secret)))return null;
    return expiresAt;
  }catch{return null}
}
