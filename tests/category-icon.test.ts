import { describe, expect, it } from "vitest";
import { isCustomCategoryIcon } from "@/components/app/category-icon";

describe("isCustomCategoryIcon", () => {
  it("accepts media paths and absolute URLs", () => {
    expect(isCustomCategoryIcon("/api/media/abc")).toBe(true);
    expect(isCustomCategoryIcon("https://cdn.example/icon.png")).toBe(true);
    expect(isCustomCategoryIcon("http://localhost:3000/x.png")).toBe(true);
  });

  it("rejects legacy seed keys and empty values", () => {
    expect(isCustomCategoryIcon("user")).toBe(false);
    expect(isCustomCategoryIcon("briefcase")).toBe(false);
    expect(isCustomCategoryIcon("")).toBe(false);
    expect(isCustomCategoryIcon(null)).toBe(false);
    expect(isCustomCategoryIcon(undefined)).toBe(false);
  });
});
