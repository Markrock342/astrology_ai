import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("light theme category icon contrast", () => {
  it("applies a light-theme filter to uploaded white icons", () => {
    const css = fs.readFileSync(
      path.join(process.cwd(), "src/app/globals.css"),
      "utf8",
    );
    const component = fs.readFileSync(
      path.join(process.cwd(), "src/components/app/category-icon.tsx"),
      "utf8",
    );

    expect(component).toContain("category-custom-icon");
    expect(css).toMatch(
      /\[data-theme="light"\][\s\S]*--category-icon-filter:\s*brightness\(0\)/,
    );
    expect(css).toContain("filter: var(--category-icon-filter)");
  });
});
