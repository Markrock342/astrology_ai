/**
 * When a question pack's questions stop working — the three choices A asked
 * for (9 Oct 2026): never, N days after purchase, or a set date, with a
 * site-wide default each pack can follow or override. Pure; shared by the
 * server (approval) and the pages (labels).
 */
export type PackExpiryRule =
  | { mode: "NONE" }
  | { mode: "DAYS"; days: number }
  | { mode: "DATE"; date: string };

export type PackExpiryFields = {
  expiryMode: "DEFAULT" | "NONE" | "DAYS" | "DATE";
  expiryDays: number | null;
  expiresOn: Date | string | null;
};

/** Marc: "ไม่ต้องหมดอายุเนอะ แฟร์ๆ" — the default until the team changes it. */
export const FALLBACK_PACK_EXPIRY: PackExpiryRule = { mode: "NONE" };

export function parsePackExpiryRule(value: unknown): PackExpiryRule {
  if (!value || typeof value !== "object") return FALLBACK_PACK_EXPIRY;
  const v = value as { mode?: unknown; days?: unknown; date?: unknown };
  if (v.mode === "DAYS" && typeof v.days === "number" && Number.isInteger(v.days) && v.days > 0) {
    return { mode: "DAYS", days: v.days };
  }
  if (v.mode === "DATE" && typeof v.date === "string" && !Number.isNaN(Date.parse(v.date))) {
    return { mode: "DATE", date: new Date(v.date).toISOString() };
  }
  return FALLBACK_PACK_EXPIRY;
}

/** The rule a pack follows: its own, or the default when set to DEFAULT (or half-filled). */
export function packExpiryRule(pkg: PackExpiryFields, fallback: PackExpiryRule): PackExpiryRule {
  if (pkg.expiryMode === "NONE") return { mode: "NONE" };
  if (pkg.expiryMode === "DAYS" && pkg.expiryDays && pkg.expiryDays > 0) {
    return { mode: "DAYS", days: pkg.expiryDays };
  }
  if (pkg.expiryMode === "DATE" && pkg.expiresOn) {
    return { mode: "DATE", date: new Date(pkg.expiresOn).toISOString() };
  }
  return fallback;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** When questions bought now under this rule end; null = never. */
export function expiryFromRule(rule: PackExpiryRule, now: Date): Date | null {
  if (rule.mode === "DAYS") return new Date(now.getTime() + rule.days * DAY_MS);
  if (rule.mode === "DATE") return new Date(rule.date);
  return null;
}

/**
 * One pool, one end date. Topping up moves the end to whichever is later, and
 * questions that never expire stay that way — buying a 30-day pack never
 * shortens what someone already had. An empty or already-ended pool takes the
 * new pack's date.
 */
export function combinePackExpiry(
  current: { balanceUnits: number; expiresAt: Date | null },
  added: Date | null,
  now: Date,
): Date | null {
  const currentLive = current.balanceUnits > 0 && (current.expiresAt === null || current.expiresAt > now);
  if (!currentLive) return added;
  if (current.expiresAt === null || added === null) return null;
  return added > current.expiresAt ? added : current.expiresAt;
}

const dateTh = (d: Date | string) =>
  new Date(d).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "numeric" });

/** "ไม่มีวันหมดอายุ" / "ใช้ได้ 30 วันหลังซื้อ" / "ใช้ได้ถึง 31 ธ.ค. 2569". */
export function packExpiryLabel(rule: PackExpiryRule): string {
  if (rule.mode === "DAYS") return `ใช้ได้ ${rule.days.toLocaleString("th-TH")} วันหลังได้รับ`;
  if (rule.mode === "DATE") return `ใช้ได้ถึง ${dateTh(rule.date)}`;
  return "ไม่มีวันหมดอายุ";
}

/** Shown when a pack has no steps of its own (Admin → แพ็กเกจ → ขั้นตอน). */
export const DEFAULT_PACK_STEPS = [
  "โอนเงินตามราคาแพ็กที่เลือก",
  "อัปโหลดสลิปในหน้าบัญชีด้านล่าง",
  "แอดมินตรวจสลิปแล้วเติมคำถามให้ ปกติภายใน 1–2 วันทำการ",
];
