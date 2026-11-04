/** Admin dates always use Gregorian dd/mm/yyyy, independent of browser locale. */
export function adminDay(value: string | Date | null | undefined): string {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-GB", { timeZone: "Asia/Bangkok", calendar: "gregory", day: "2-digit", month: "2-digit", year: "numeric" });
}
export function displayDayToIso(value: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return null;
  const [, day, month, year] = match;
  const iso = `${year}-${month}-${day}`;
  const date = new Date(`${iso}T00:00:00Z`);
  return Number(year) >= 1900 && Number(year) < 2200 && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === iso ? iso : null;
}
export function isoDayDisplay(value: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.split("-").reverse().join("/") : "";
}

export type QuestionPools = {
  includedBalanceUnits: number; purchasedBalanceUnits: number;
  periodEndsAt?: Date | string | null; purchasedExpiresAt: Date | string | null;
};
/** Ignore a stale purchased deadline when that pool has no questions left. */
export function questionExpiry(pool: QuestionPools | null | undefined): Date | string | null {
  if (!pool) return null;
  if (pool.purchasedBalanceUnits <= 0) return pool.periodEndsAt ?? null;
  if (pool.includedBalanceUnits <= 0) return pool.purchasedExpiresAt;
  const dates = [pool.periodEndsAt, pool.purchasedExpiresAt].filter((d): d is Date | string => d != null);
  return dates.sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0] ?? null;
}
