import { describe, expect, it } from "vitest";
import { knowledgeSource } from "@/lib/knowledge-provenance";
describe("knowledge document origin", () => {
  it("uses recorded creation evidence for authored documents", () => {
    expect(knowledgeSource("authored", true)).toBe("TEAM");
    expect(knowledgeSource("kb-global-planets", true)).toBe("TEAM");
  });
  it("recognizes known defaults and the intentionally separate system guide", () => {
    expect(knowledgeSource("kb-global-planets", false)).toBe("DEFAULT");
    expect(knowledgeSource("seed-knowledge-cat-self", false)).toBe("DEFAULT");
    expect(knowledgeSource("kb-team-engine-formulas", false)).toBe("SYSTEM_GUIDE");
  });
  it("does not infer authorship or a seed source from an arbitrary ID prefix", () => {
    expect(knowledgeSource("kb-global-unrecognized-import", false)).toBe("UNKNOWN");
    expect(knowledgeSource("seed-knowledge-cat-custom", false)).toBe("UNKNOWN");
    expect(knowledgeSource("cm-existing-unknown", false)).toBe("UNKNOWN");
  });
});
