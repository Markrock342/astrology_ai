import { beforeEach, describe, expect, it } from "vitest";
import { isValidPreviewToken, mintPreviewToken } from "@/server/cms/preview-token";

describe("CMS preview cookie", () => {
  beforeEach(() => {
    process.env.AUTH_SECRET = "test-secret";
  });

  it("refuses the old hand-settable value", () => {
    expect(isValidPreviewToken("1")).toBe(false);
  });

  it("accepts a minted token until it expires", () => {
    const t = mintPreviewToken(60, 1_000_000)!;
    expect(isValidPreviewToken(t, 1_000_000 + 59_000)).toBe(true);
    expect(isValidPreviewToken(t, 1_000_000 + 61_000)).toBe(false);
  });

  it("refuses a forged expiry", () => {
    const [, mac] = mintPreviewToken(60, 1_000_000)!.split(".");
    expect(isValidPreviewToken(`9999999999999.${mac}`, 1_000_000)).toBe(false);
  });
});
