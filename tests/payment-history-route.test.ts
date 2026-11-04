import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
const m = vi.hoisted(() => ({ admin: vi.fn(), list: vi.fn() }));
vi.mock("@/server/auth/rbac", () => ({ requireAdmin: m.admin }));
vi.mock("@/server/payment/payment-history-service", () => ({ listPaymentHistory: m.list }));
import { GET } from "@/app/api/admin/payments/history/route";
const request = (q = "") => new Request(`https://example.invalid/api/admin/payments/history?${q}`);
beforeEach(() => { vi.clearAllMocks(); m.admin.mockResolvedValue({ id: "operator" }); m.list.mockResolvedValue({ items: [], total: 0, page: 1 }); });
describe("private payment history", () => {
  for (const code of ["UNAUTHENTICATED", "FORBIDDEN"] as const) it(`rejects ${code} before reading history`, async () => {
    m.admin.mockRejectedValue(new AppError(code));
    expect((await GET(request())).status).toBe(code === "UNAUTHENTICATED" ? 401 : 403); expect(m.list).not.toHaveBeenCalled();
  });
  for (const q of ["from=2026-02-31", "from=2026-11-05&to=2026-11-04", "status=PENDING", "pageSize=10000"]) it(`rejects invalid filters: ${q}`, async () => {
    expect((await GET(request(q))).status).toBe(422); expect(m.list).not.toHaveBeenCalled();
  });
  it("uses private no-store and passes validated filters", async () => {
    const result = await GET(request("from=2026-11-04&to=2026-11-04&reviewerId=operator&status=APPROVED"));
    expect(result.status).toBe(200); expect(result.headers.get("cache-control")).toBe("private, no-store");
    expect(m.list).toHaveBeenCalledWith(expect.objectContaining({ from: "2026-11-04", to: "2026-11-04", reviewerId: "operator", status: "APPROVED" }));
  });
});
