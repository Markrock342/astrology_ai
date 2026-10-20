import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("../src/components/marketing/contact-form.tsx", import.meta.url),
  "utf8",
);

describe("contact form text persistence", () => {
  it("keeps a browser-local draft so captcha rerenders cannot erase Thai IME text", () => {
    expect(source).toContain("const data = new FormData(form)");
    expect(source).toContain("form.reset()");
    expect(source).toContain('value={message}');
    expect(source).toContain("sessionStorage.setItem(CONTACT_DRAFT_KEY, next)");
    expect(source).toContain("sessionStorage.removeItem(CONTACT_DRAFT_KEY)");
  });

  it("keeps the multiline field out of the capsule radius that clips its first line", () => {
    const textarea = source.match(/<textarea[\s\S]*?\/>/)?.[0] ?? "";

    expect(textarea).toContain("rounded-2xl");
    expect(textarea).not.toContain("rounded-xl");
  });
});
