import { describe, expect, it } from "vitest";
import { BUILD_INFO, runtimeCommit } from "@/config/build-info";

describe("build info", () => {
  it("always answers with a commit field and a timestamp", () => {
    // /api/version is how a deploy is confirmed from outside; it must never
    // throw or return a partial object, even with no platform variables set.
    expect(typeof BUILD_INFO.commit).toBe("string");
    expect(BUILD_INFO.commit.length).toBeGreaterThan(0);
    expect(Number.isNaN(Date.parse(BUILD_INFO.builtAt))).toBe(false);
    expect(typeof runtimeCommit()).toBe("string");
  });
});
