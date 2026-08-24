import { describe, expect, it } from "vitest";
import { filterSearchableOptions } from "@/components/ui/searchable-select";

describe("searchable location select", () => {
  const options = ["กรุงเทพมหานคร", "กระบี่", "เชียงใหม่"];

  it("filters from typed Thai text without requiring a scroll", () => {
    expect(filterSearchableOptions(options, "กรุ")).toEqual(["กรุงเทพมหานคร"]);
    expect(filterSearchableOptions(options, "เชียง")).toEqual(["เชียงใหม่"]);
    expect(filterSearchableOptions(["พระนคร"], "เขตพระ")).toEqual(["พระนคร"]);
  });

  it("shows the full list for an empty query", () => {
    expect(filterSearchableOptions(options, "  ")).toEqual(options);
  });
});
