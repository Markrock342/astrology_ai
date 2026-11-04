import { describe, expect, it } from "vitest";
import { adminDay, displayDayToIso, isoDayDisplay, questionExpiry } from "@/lib/admin-dates";
import { csvCell, memberCsv, signupRangeStart } from "@/lib/member-export";
describe("unambiguous Bangkok admin dates", () => {
  it("keeps 4 November distinct from 11 April and round-trips Gregorian format", () => {
    expect(displayDayToIso("04/11/2026")).toBe("2026-11-04");
    expect(displayDayToIso("11/04/2026")).toBe("2026-04-11");
    expect(adminDay("2026-11-04T16:59:59Z")).toBe("04/11/2026");
    expect(isoDayDisplay("2026-11-04")).toBe("04/11/2026");
    for (const input of ["31/02/2026", "29/02/2025", "04/13/2026", "11/4/2026", "2026-11-04"]) expect(displayDayToIso(input)).toBeNull();
    expect(displayDayToIso("29/02/2028")).toBe("2028-02-29");
  });
  it("ignores the reported stale 11 Nov purchase deadline when purchased questions are zero", () => {
    const pool = { includedBalanceUnits: 75000, purchasedBalanceUnits: 0, periodEndsAt: "2026-11-04T16:59:59Z", purchasedExpiresAt: "2026-11-11T10:13:53Z" };
    expect(adminDay(questionExpiry(pool))).toBe("04/11/2026");
    expect(questionExpiry({ ...pool, includedBalanceUnits: 0, purchasedBalanceUnits: 15000 })).toBe(pool.purchasedExpiresAt);
  });
});
describe("signup export", () => {
  const now = new Date("2026-11-03T18:00:00Z"); // 4 November in Bangkok
  it("uses Bangkok signup calendar boundaries for all requested ranges", () => {
    expect(signupRangeStart("7", now)?.toISOString()).toBe("2026-10-28T17:00:00.000Z");
    expect(signupRangeStart("28", now)?.toISOString()).toBe("2026-10-07T17:00:00.000Z");
    expect(signupRangeStart("month", now)?.toISOString()).toBe("2026-10-31T17:00:00.000Z");
    for (const range of ["90", "180", "365"] as const) expect(now.getTime() - signupRangeStart(range, now)!.getTime()).toBeGreaterThan((Number(range) - 1) * 86400000);
    expect(signupRangeStart("all", now)).toBeUndefined();
  });
  it("quotes Thai CSV, prevents spreadsheet formula injection and excludes expired pools from balance", () => {
    expect(csvCell('=HYPERLINK("bad")')).toBe('"\'=HYPERLINK(""bad"")"');
    expect(csvCell('a,b\n"c"')).toBe('"a,b\n""c"""');
    const csv = memberCsv([{ email: "test@example.invalid", packageName: "90 คำถาม", purchasedAt: null, createdAt: now, status: "ACTIVE", wallet: { includedBalanceUnits: 15000, purchasedBalanceUnits: 30000, periodEndsAt: "2026-01-01Z", purchasedExpiresAt: null } }], now);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain('"Email","แพ็กล่าสุด","ซื้อเมื่อ","คำถามหมดอายุ","คำถามเหลือ","สถานะ","สมัครเมื่อ"');
    expect(csv).toContain('"2","ใช้งาน","04/11/2026"');
  });
});
