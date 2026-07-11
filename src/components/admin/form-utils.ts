/** Shared form helpers for Admin CMS managers. */

export function linesToArray(text: string): string[] {
  return text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function arrayToLines(arr: string[] | null | undefined): string {
  return (arr ?? []).join("\n");
}

/** Shallow field-level diff for revision preview (stringified values). */
export function fieldDiff(
  current: Record<string, unknown> | null | undefined,
  snapshot: Record<string, unknown> | null | undefined,
): Array<{ key: string; before: string; after: string }> {
  const a = current ?? {};
  const b = snapshot ?? {};
  const keys = Array.from(new Set([...Object.keys(a), ...Object.keys(b)])).sort();
  const out: Array<{ key: string; before: string; after: string }> = [];
  for (const key of keys) {
    const before = JSON.stringify(a[key] ?? null);
    const after = JSON.stringify(b[key] ?? null);
    if (before !== after) out.push({ key, before, after });
  }
  return out;
}

export function confirmLeave(message = "มีการแก้ไขที่ยังไม่บันทึก ต้องการออกหรือไม่?"): boolean {
  if (typeof window === "undefined") return true;
  return window.confirm(message);
}
