import { describe, expect, it } from "vitest";
import { matchesExpiryFilter } from "@/lib/member-export";

// A (11 Nov 2026): pick members for reminder emails by expiry.
const now = new Date("2026-11-11T05:00:00Z");
const day = 86_400_000;
const pool = (endsInDays: number | null, questions: number) => ({
  includedBalanceUnits: questions * 15_000,
  purchasedBalanceUnits: 0,
  periodEndsAt: endsInDays == null ? null : new Date(now.getTime() + endsInDays * day),
  purchasedExpiresAt: null,
});

describe("export expiry filter", () => {
  it("sorts members into the five groups", () => {
    const expired = pool(-2, 3), soonEmpty = pool(3, 0), soonLeft = pool(3, 4), later = pool(20, 4), never = pool(null, 2);
    const pick = (f: Parameters<typeof matchesExpiryFilter>[1]) =>
      [expired, soonEmpty, soonLeft, later, never].map((p) => matchesExpiryFilter(p, f, now));
    expect(pick("expired")).toEqual([true, false, false, false, false]);
    expect(pick("soon_empty")).toEqual([false, true, false, false, false]);
    expect(pick("soon_left")).toEqual([false, false, true, false, false]);
    expect(pick("none")).toEqual([false, false, false, false, true]);
    expect(pick("all")).toEqual([true, true, true, true, true]);
  });

  it("an account with no wallet has no expiry", () => {
    expect(matchesExpiryFilter(null, "none", now)).toBe(true);
    expect(matchesExpiryFilter(null, "expired", now)).toBe(false);
  });
});
