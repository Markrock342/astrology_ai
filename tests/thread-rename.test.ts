import { describe, expect, it } from "vitest";
import { renameThreadInList } from "@/components/app/app-data-provider";

describe("sidebar thread rename", () => {
  it("updates only the selected chat title immediately", () => {
    const threads = [
      { id: "one", title: "ชื่อเดิม", categorySlug: "career" },
      { id: "two", title: "อีกแชท", categorySlug: "love" },
    ];

    expect(renameThreadInList(threads, "one", "งานที่เหมาะกับฉัน")).toEqual([
      { id: "one", title: "งานที่เหมาะกับฉัน", categorySlug: "career" },
      { id: "two", title: "อีกแชท", categorySlug: "love" },
    ]);
  });
});
