import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ count: vi.fn(), findFirst: vi.fn(), create: vi.fn() }));
vi.mock("@/server/db", () => ({
  prisma: { contentRevision: { count: mocks.count, findFirst: mocks.findFirst, create: mocks.create } },
}));

import { recordBaselineIfFirstPublish } from "@/server/admin/content-revision-service";

// QA 2026-10-04: history started at the first edit, so the original content
// could never be restored.
describe("baseline revision", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findFirst.mockResolvedValue(null);
    mocks.create.mockImplementation(async ({ data }) => data);
  });

  it("keeps the content as it was before the first publish", async () => {
    mocks.count.mockResolvedValue(0);
    const row = await recordBaselineIfFirstPublish({
      entityType: "PROMPT_TEMPLATE",
      entityId: "p1",
      snapshotJson: { content: "ต้นฉบับ" },
      actor: { id: "a" },
    });
    expect(row).toMatchObject({ action: "PUBLISH", snapshotJson: { content: "ต้นฉบับ" }, version: 1 });
  });

  it("adds nothing once a published revision exists", async () => {
    mocks.count.mockResolvedValue(2);
    expect(
      await recordBaselineIfFirstPublish({
        entityType: "PROMPT_TEMPLATE",
        entityId: "p1",
        snapshotJson: {},
        actor: { id: "a" },
      }),
    ).toBeNull();
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
