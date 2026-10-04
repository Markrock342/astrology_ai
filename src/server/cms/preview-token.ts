import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * The CMS preview cookie used to hold "1": anyone could set it and read
 * unpublished drafts on the public pages. It now carries an expiry signed with
 * AUTH_SECRET, minted only by the admin endpoint.
 */
function sign(payload: string): string | null {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret) return null;
  return createHmac("sha256", `cms-preview:${secret}`).update(payload).digest("base64url");
}

export function mintPreviewToken(maxAgeSec: number, now = Date.now()): string | null {
  const exp = String(now + maxAgeSec * 1000);
  const mac = sign(exp);
  return mac ? `${exp}.${mac}` : null;
}

export function isValidPreviewToken(value: string | undefined, now = Date.now()): boolean {
  if (!value) return false;
  const [exp, mac] = value.split(".");
  if (!exp || !mac || !/^\d+$/.test(exp) || Number(exp) < now) return false;
  const want = sign(exp);
  if (!want) return false;
  const a = Buffer.from(mac);
  const b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}
