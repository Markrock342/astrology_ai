import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
const m = vi.hoisted(() => ({ admin: vi.fn(), get: vi.fn(), start: vi.fn(), run: vi.fn(), export: vi.fn(), after: vi.fn() }));
vi.mock("@/server/auth/rbac", () => ({ requireAdmin: m.admin }));
vi.mock("@/server/admin/chat-insights-service", () => ({ getChatInsights: m.get, startChatInsights: m.start, runChatInsights: m.run }));
vi.mock("@/server/admin/member-export-service", () => ({ exportMembers: m.export }));
vi.mock("next/server", async original => ({ ...await original<typeof import("next/server")>(), after: m.after }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn(), clientIp: () => undefined }));
import { GET as insights, POST as generate } from "@/app/api/admin/feedback/route";
import { GET as download } from "@/app/api/admin/users/export/route";
beforeEach(() => vi.clearAllMocks());
describe("private admin analytics and member exports", () => {
  for (const code of ["UNAUTHENTICATED", "FORBIDDEN"] as const) it(`blocks ${code} before reading/exporting private information or calling AI`, async () => {
    m.admin.mockRejectedValue(new AppError(code));
    const expected = code === "UNAUTHENTICATED" ? 401 : 403;
    expect((await insights()).status).toBe(expected);
    expect((await generate(new Request("https://example.invalid/api/admin/feedback", { method: "POST" }))).status).toBe(expected);
    expect((await download(new Request("https://example.invalid/api/admin/users/export?range=all"))).status).toBe(expected);
    for (const fn of [m.get, m.start, m.run, m.export, m.after]) expect(fn).not.toHaveBeenCalled();
  });
  it("returns only aggregate service data and private CSV with no-store headers", async () => {
    m.admin.mockResolvedValue({ id: "admin" }); m.get.mockResolvedValue({ status: "idle", stats: { up: 2, down: 1 } }); m.export.mockResolvedValue("\uFEFFEmail\r\n");
    const response = await insights(); expect(await response.json()).toEqual({ ok: true, data: { status: "idle", stats: { up: 2, down: 1 } } });
    expect(response.headers.get("cache-control")).toContain("no-store");
    const csv = await download(new Request("https://example.invalid/api/admin/users/export?range=7"));
    expect(csv.headers.get("content-type")).toContain("text/csv");expect(csv.headers.get("cache-control")).toContain("no-store");
  });
});
