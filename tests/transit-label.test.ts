import { describe, expect, it } from "vitest";
import {
  formatTransitDateLabel,
  formatTransitThreadLabel,
} from "@/lib/transit-label";

describe("formatTransitThreadLabel", () => {
  it("uses Bangkok calendar day, not UTC", () => {
    // 3 Sep 2026 00:30 ICT is still 2 Sep in UTC.
    const lateEveningUtc = new Date("2026-09-02T17:30:00.000Z");
    expect(formatTransitDateLabel(lateEveningUtc)).toBe("3 ก.ย. 2569");
    expect(formatTransitThreadLabel(lateEveningUtc, "00:30")).toBe(
      "3 ก.ย. 2569 · 00:30",
    );
  });
});
