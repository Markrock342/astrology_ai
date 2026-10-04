import { describe, expect, it } from "vitest";
import { announcementSchema, cmsSiteFooterSchema } from "@/lib/admin-schemas";

// QA 2026-10-04: CTA, footer and banner links accepted javascript: URLs.
describe("links an admin types into the site", () => {
  const footer = (href: string) => ({
    brandBlurb: "b",
    copyright: "c",
    links: [{ label: "x", href }],
    socialLinks: [],
  });

  it.each(["/pricing", "#faq", "https://line.me/x", "mailto:a@b.co"])("takes %s", (href) => {
    expect(cmsSiteFooterSchema.safeParse(footer(href)).success).toBe(true);
  });

  it.each(["javascript:alert(1)", " JavaScript:alert(1)", "//evil.example", "data:text/html,x"])("refuses %s", (href) => {
    expect(cmsSiteFooterSchema.safeParse(footer(href)).success).toBe(false);
  });

  it("refuses a javascript: banner link and keeps an empty one", () => {
    const base = { title: "t", message: "m" };
    expect(announcementSchema.safeParse({ ...base, linkUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(announcementSchema.safeParse({ ...base, linkUrl: "" }).success).toBe(true);
    expect(announcementSchema.safeParse({ ...base, linkUrl: "https://horasard.com/pricing" }).success).toBe(true);
  });
});
