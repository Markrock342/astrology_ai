import { describe, expect, it } from "vitest";
import {
  combinePackExpiry,
  expiryFromRule,
  packExpiryLabel,
  packExpiryRule,
  parsePackExpiryRule,
} from "@/lib/pack-expiry";

// A, 9 Oct 2026: packs may never expire, expire a month after purchase, or
// on a set date — with a default the team can set.
const now = new Date("2026-10-09T05:00:00Z");
const day = 24 * 60 * 60 * 1000;

describe("pack expiry rules", () => {
  it("defaults to never when nothing valid is stored", () => {
    expect(parsePackExpiryRule(null)).toEqual({ mode: "NONE" });
    expect(parsePackExpiryRule({ mode: "DAYS", days: 0 })).toEqual({ mode: "NONE" });
    expect(parsePackExpiryRule({ mode: "DATE", date: "nope" })).toEqual({ mode: "NONE" });
    expect(parsePackExpiryRule({ mode: "DAYS", days: 30 })).toEqual({ mode: "DAYS", days: 30 });
  });

  it("follows the default unless the pack sets its own", () => {
    const fallback = { mode: "DAYS" as const, days: 30 };
    expect(packExpiryRule({ expiryMode: "DEFAULT", expiryDays: null, expiresOn: null }, fallback)).toEqual(fallback);
    expect(packExpiryRule({ expiryMode: "NONE", expiryDays: null, expiresOn: null }, fallback)).toEqual({ mode: "NONE" });
    expect(packExpiryRule({ expiryMode: "DAYS", expiryDays: 7, expiresOn: null }, fallback)).toEqual({ mode: "DAYS", days: 7 });
    // Half-filled: DATE with no date falls back rather than never expiring.
    expect(packExpiryRule({ expiryMode: "DATE", expiryDays: null, expiresOn: null }, fallback)).toEqual(fallback);
  });

  it("turns a rule into an end date", () => {
    expect(expiryFromRule({ mode: "NONE" }, now)).toBeNull();
    expect(expiryFromRule({ mode: "DAYS", days: 30 }, now)?.getTime()).toBe(now.getTime() + 30 * day);
    expect(expiryFromRule({ mode: "DATE", date: "2026-12-31T16:59:59.000Z" }, now)?.toISOString()).toBe(
      "2026-12-31T16:59:59.000Z",
    );
  });

  it("labels each rule in Thai", () => {
    expect(packExpiryLabel({ mode: "NONE" })).toBe("ไม่มีวันหมดอายุ");
    expect(packExpiryLabel({ mode: "DAYS", days: 30 })).toBe("ใช้ได้ 30 วันหลังได้รับ");
    expect(packExpiryLabel({ mode: "DATE", date: "2026-12-31T16:59:59.000Z" })).toContain("ธ.ค.");
  });
});

describe("topping up never shortens what is left", () => {
  const in10 = new Date(now.getTime() + 10 * day);
  const in30 = new Date(now.getTime() + 30 * day);

  it("an empty or ended pool takes the new pack's date", () => {
    expect(combinePackExpiry({ balanceUnits: 0, expiresAt: null }, in30, now)).toEqual(in30);
    expect(combinePackExpiry({ balanceUnits: 50_000, expiresAt: new Date(now.getTime() - day) }, in30, now)).toEqual(in30);
  });

  it("keeps the later date", () => {
    expect(combinePackExpiry({ balanceUnits: 50_000, expiresAt: in10 }, in30, now)).toEqual(in30);
    expect(combinePackExpiry({ balanceUnits: 50_000, expiresAt: in30 }, in10, now)).toEqual(in30);
  });

  it("never-expiring questions stay that way, and make the pool never expire", () => {
    expect(combinePackExpiry({ balanceUnits: 50_000, expiresAt: null }, in30, now)).toBeNull();
    expect(combinePackExpiry({ balanceUnits: 50_000, expiresAt: in10 }, null, now)).toBeNull();
  });
});
