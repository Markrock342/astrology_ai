import { describe, expect, it, vi } from "vitest";
vi.mock("@/server/db", () => ({ prisma: {} }));
vi.mock("@/config/env", () => ({ env: {} }));
import { senderFrom } from "@/server/email/mailer";
import { verificationEmail } from "@/server/email/templates";

// A, 10 Nov 2026: the inbox showed "HoraSard"; the team wants "HORASARD" and the logo.
describe("email sender and header", () => {
  it("sends as HORASARD from the configured address", () => {
    expect(senderFrom("HoraSard <noreply@horasard.com>")).toBe("HORASARD <noreply@horasard.com>");
    expect(senderFrom("noreply@horasard.com")).toBe("HORASARD <noreply@horasard.com>");
    expect(senderFrom(undefined)).toBe("HORASARD <onboarding@resend.dev>");
  });

  it("puts the logo at the top of the HTML", () => {
    const mail = verificationEmail("ทดสอบ", "https://horasard.com/verify?t=x", 24);
    expect(mail.html).toContain('src="https://horasard.com/logo.png"');
    expect(mail.html.indexOf("logo.png")).toBeLessThan(mail.html.indexOf("สวัสดี"));
  });
});
