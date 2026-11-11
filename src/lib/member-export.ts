import { adminDay, questionExpiry, type QuestionPools } from "./admin-dates";
import { unitsToQuestions } from "./usage-budget-display";
export const EXPORT_RANGES = ["7", "28", "90", "month", "180", "365", "all"] as const;

/**
 * The second export filter A asked for (11 Nov 2026), applied on top of the
 * signup range — to pick who gets a reminder email.
 */
export const EXPIRY_FILTERS = ["all", "expired", "soon_empty", "soon_left", "none"] as const;
export type ExpiryFilter = typeof EXPIRY_FILTERS[number];
export const EXPIRY_FILTER_LABELS: Record<ExpiryFilter, string> = {
  all: "ทั้งหมด",
  expired: "หมดอายุแล้ว",
  soon_empty: "จะหมดอายุในอีก 7 วัน / ไม่มีคำถามคงเหลือ",
  soon_left: "จะหมดอายุในอีก 7 วัน / มีคำถามเหลืออยู่",
  none: "ไม่มีหมดอายุ",
};
const SOON_MS = 7 * 24 * 60 * 60 * 1000;

/** Questions still usable: a pool past its date counts as empty. */
export function remainingUnits(pool: QuestionPools | null, now: Date): number {
  if (!pool) return 0;
  return (pool.periodEndsAt && new Date(pool.periodEndsAt) <= now ? 0 : pool.includedBalanceUnits)
    + (pool.purchasedExpiresAt && new Date(pool.purchasedExpiresAt) <= now ? 0 : pool.purchasedBalanceUnits);
}

export function matchesExpiryFilter(pool: QuestionPools | null, filter: ExpiryFilter, now: Date): boolean {
  if (filter === "all") return true;
  const expiry = questionExpiry(pool);
  if (filter === "none") return expiry == null;
  if (expiry == null) return false;
  const at = new Date(expiry).getTime();
  if (filter === "expired") return at <= now.getTime();
  const soon = at > now.getTime() && at <= now.getTime() + SOON_MS;
  if (!soon) return false;
  const left = unitsToQuestions(remainingUnits(pool, now)) > 0;
  return filter === "soon_left" ? left : !left;
}
export type ExportRange = typeof EXPORT_RANGES[number];
/** Inclusive Bangkok calendar days: 7 = today and the previous six days. */
export function signupRangeStart(range: ExportRange, now: Date): Date | undefined {
  if (range === "all") return undefined;
  const [year, month, day] = now.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" }).split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, range === "month" ? 1 : day, -7));
  if (range !== "month") start.setUTCDate(start.getUTCDate() - Number(range) + 1);
  return start;
}
export function csvCell(value: unknown): string {
  let text = String(value ?? "");
  if (/^[\s]*[=+\-@]/u.test(text) || /^[\t\r]/.test(text)) text = "'" + text;
  return `"${text.replaceAll('"', '""')}"`;
}
export function memberCsv(rows: Array<{
  email: string; packageName: string; purchasedAt: Date | null; createdAt: Date; status: string; wallet: QuestionPools | null;
}>, now: Date): string {
  const header = ["Email", "แพ็กล่าสุด", "ซื้อเมื่อ", "คำถามหมดอายุ", "คำถามเหลือ", "สถานะ", "สมัครเมื่อ"];
  const lines = rows.map(row => {
    const pool = row.wallet;
    const remaining = remainingUnits(pool, now);
    return [row.email, row.packageName, adminDay(row.purchasedAt), questionExpiry(pool) ? adminDay(questionExpiry(pool)) : "ไม่มีวันหมดอายุ",
      unitsToQuestions(remaining), row.status === "ACTIVE" ? "ใช้งาน" : "ระงับ", adminDay(row.createdAt)];
  });
  return "\uFEFF" + [header, ...lines].map(row => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
