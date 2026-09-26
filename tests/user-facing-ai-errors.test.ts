import { describe, expect, it } from "vitest";
import {
  AI_CAPACITY_USER_MESSAGE,
  AI_UNAVAILABLE_USER_MESSAGE,
  providerAlertUserMessage,
} from "@/server/ai/provider-alerts";
import { AppError } from "@/lib/errors";

const INTERNAL = /gemini|google|ai studio|api key|เติมเงิน|env/i;

describe("what a customer is told when the site's AI side fails", () => {
  it("says the site is busy when the provider is out of credit or quota — the team's wording", () => {
    expect(providerAlertUserMessage("BILLING")).toBe(AI_CAPACITY_USER_MESSAGE);
    expect(providerAlertUserMessage("QUOTA")).toBe(AI_CAPACITY_USER_MESSAGE);
    expect(AI_CAPACITY_USER_MESSAGE).toContain(
      "ขณะนี้มีผู้ใช้งานระบบพร้อมกันเป็นจำนวนมาก",
    );
    expect(AI_CAPACITY_USER_MESSAGE).toContain("กรุณาลองใหม่อีกครั้งในภายหลัง");
  });

  it("never names the vendor, the console, or a key", () => {
    for (const kind of ["BILLING", "QUOTA", "KEY"] as const) {
      expect(providerAlertUserMessage(kind) ?? "").not.toMatch(INTERNAL);
    }
    expect(AI_UNAVAILABLE_USER_MESSAGE).not.toMatch(INTERNAL);
  });

  it("gives running out of site capacity its own code, as a 503", () => {
    expect(new AppError("AI_CAPACITY", AI_CAPACITY_USER_MESSAGE).status).toBe(503);
  });
});
