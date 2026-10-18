import { describe, expect, it } from "vitest";
import { formatDivisionalPosition, signLabel } from "@/lib/chart-theme";

describe("Thai sign labels", () => {
  it("expands MyHora abbreviations to full names", () => {
    expect(signLabel("กฎ")).toBe("กรกฎ");
    expect(signLabel("07 : พจ")).toBe("พิจิก");
    expect(signLabel("กภ")).toBe("กุมภ์");
  });

  it("keeps the divisional index and expands only the sign", () => {
    expect(formatDivisionalPosition("1 : 2 : กฎ")).toBe("1 : 2 : กรกฎ");
    expect(formatDivisionalPosition("3 : 4 : พจ")).toBe("3 : 4 : พิจิก");
  });
});
