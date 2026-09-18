import { describe, expect, it } from "vitest";
import { sourceFingerprint } from "../scripts/source-fingerprint.mjs";

describe("source fingerprint", () => {
  it("is stable for the same tree", () => {
    // /api/version reports this value; comparing it with `npm run fingerprint`
    // is how a deploy is confirmed without any platform support.
    const a = sourceFingerprint();
    const b = sourceFingerprint();
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{12}$/);
  });
});
