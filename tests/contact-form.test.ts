import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("../src/components/marketing/contact-form.tsx", import.meta.url),
  "utf8",
);

describe("contact form text persistence", () => {
  it("leaves field values in the browser so captcha rerenders cannot erase Thai IME text", () => {
    expect(source).toContain("const data = new FormData(form)");
    expect(source).toContain("form.reset()");
    expect(source).not.toContain('value={message}');
    expect(source).not.toContain('onChange={(event) => setMessage');
  });
});
