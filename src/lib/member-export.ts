import { adminDay, questionExpiry, type QuestionPools } from "./admin-dates";
import { unitsToQuestions } from "./usage-budget-display";
export const EXPORT_RANGES = ["7", "28", "90", "month", "180", "365", "all"] as const;
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
    const remaining = pool ? (pool.periodEndsAt && new Date(pool.periodEndsAt) <= now ? 0 : pool.includedBalanceUnits)
      + (pool.purchasedExpiresAt && new Date(pool.purchasedExpiresAt) <= now ? 0 : pool.purchasedBalanceUnits) : 0;
    return [row.email, row.packageName, adminDay(row.purchasedAt), questionExpiry(pool) ? adminDay(questionExpiry(pool)) : "ไม่มีวันหมดอายุ",
      unitsToQuestions(remaining), row.status === "ACTIVE" ? "ใช้งาน" : "ระงับ", adminDay(row.createdAt)];
  });
  return "\uFEFF" + [header, ...lines].map(row => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
