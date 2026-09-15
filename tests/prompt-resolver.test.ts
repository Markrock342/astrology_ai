import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  FREE_TRIAL_DEPTH_PERCENT,
  PLAN_HINT_FREE,
  PLAN_HINT_PRO,
} from "@/config/constants";

const mocks = vi.hoisted(() => ({ findUnique: vi.fn() }));
vi.mock("@/server/db", () => ({
  prisma: { promptTemplate: { findUnique: mocks.findUnique } },
}));

import { resolvePromptParts } from "@/server/horoscope/prompt-resolver";

describe("resolvePromptParts plan block", () => {
  beforeEach(() => {
    mocks.findUnique.mockReset();
    mocks.findUnique.mockResolvedValue(null);
  });

  it("gives Free a trial-depth instruction derived from the single percent knob", async () => {
    const parts = await resolvePromptParts({ plan: "FREE", categoryName: "การงาน" });
    expect(parts.plan).toBe(PLAN_HINT_FREE);
    expect(parts.plan).toContain(`${FREE_TRIAL_DEPTH_PERCENT}%`);
    expect(parts.plan).toContain("เพียง 1–2 อย่าง");
    expect(parts.plan).toContain("ระดับ Pro");
  });

  it("gives Pro the full-depth instruction", async () => {
    const parts = await resolvePromptParts({ plan: "PRO", categoryName: "การงาน" });
    expect(parts.plan).toBe(PLAN_HINT_PRO);
    expect(parts.plan).toContain("อ่านให้ครบทุกสัญญาณ");
  });
});
