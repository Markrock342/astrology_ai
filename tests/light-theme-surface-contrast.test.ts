import { describe, expect, it } from "vitest";
import { buildThemeVars } from "@/lib/theme-colors";

describe("light theme surface contrast", () => {
  it("derives a bright raised surface and two visible border strengths", () => {
    const vars = buildThemeVars({
      primary: "#c9a24b",
      secondary: "#1f8f7a",
      background: "#f3f4f6",
    });

    expect(vars["--surface"]).toBe("#fcfcfc");
    expect(vars["--surface-2"]).toBe("#e8e9eb");
    expect(vars["--border"]).toBe("#cbcccf");
    expect(vars["--border-strong"]).toBe("#acaeb1");
    expect(vars["--border-strong"]).not.toBe(vars["--border"]);
  });
});
