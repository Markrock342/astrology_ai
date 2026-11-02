import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { userListQuerySchema, paymentListQuerySchema } from "@/lib/admin-schemas";

const mocks = vi.hoisted(() => ({ raw: vi.fn(), users: vi.fn(), payments: vi.fn(), packages: vi.fn() }));
vi.mock("@/server/db", () => ({ prisma: {
  $queryRaw: mocks.raw, user: { findMany: mocks.users }, payment: { findMany: mocks.payments },
  package: { findMany: mocks.packages },
} }));
import { listUsers, userListOrder } from "@/server/admin/user-admin-service";
import { listPayments, paymentListOrder } from "@/server/payment/payment-service";

function query(index: number) {
  const [strings, ...values] = mocks.raw.mock.calls[index];
  return Prisma.sql(strings, ...values);
}

beforeEach(() => vi.resetAllMocks());

describe("admin list pagination and filtering", () => {
  it("preserves database order, clamps an obsolete page, and filters current package access", async () => {
    mocks.raw.mockResolvedValueOnce([{ total: BigInt(21) }]).mockResolvedValueOnce([
      { id: "b", lastActiveAt: null }, { id: "a", lastActiveAt: null },
    ]);
    mocks.users.mockResolvedValue([{ id: "a", payments: [] }, { id: "b", payments: [] }]);
    const result = await listUsers({ page: 99, pageSize: 20, sort: "balance", direction: "asc", packageCode: "PLUS", search: "_%" });
    expect(result.page).toBe(2);
    expect(result.items.map((r) => r.id)).toEqual(["b", "a"]);
    const count = query(0), page = query(1);
    expect(count.text).toContain('current_pkg.code =');
    expect(count.text).toContain("s.status = 'ACTIVE'");
    expect(count.text).not.toContain("FROM payments");
    expect(count.values).toContain("PLUS");
    expect(count.values).toContain("%\\_\\%%");
    expect(page.text).toContain('COALESCE(w."purchasedBalanceUnits", 0) ASC NULLS LAST');
    expect(page.values.slice(-2)).toEqual([20, 20]);
  });

  it("Free excludes only live Pro access and shares one expiry instant across the page", async () => {
    mocks.raw.mockResolvedValueOnce([{ total: BigInt(0) }]).mockResolvedValueOnce([]);
    mocks.users.mockResolvedValue([]);
    await listUsers({ page: 1, pageSize: 20, packageCode: "FREE" });
    const count = query(0), page = query(1);
    expect(count.text).toContain("NOT EXISTS");
    expect(count.text).toContain("current_pkg.type = 'PRO'");
    expect(count.text).toContain('s."expiresAt" >');
    expect(count.text).not.toContain("FROM payments");
    const instant = count.values.find((value) => value instanceof Date);
    expect(instant).toBeInstanceOf(Date);
    expect(page.values).toContain(instant);
    expect(mocks.users.mock.calls[0][0].select.subscriptions.where.OR[1].expiresAt.gt).toBe(instant);
  });

  it("filters payment status, package and literal search before pagination", async () => {
    mocks.raw.mockResolvedValueOnce([{ total: BigInt(0) }]).mockResolvedValueOnce([]);
    mocks.payments.mockResolvedValue([]);
    const result = await listPayments({ page: 4, pageSize: 20, status: "PENDING", packageCode: "PRO", search: "a_b%", sort: "amount", direction: "desc" });
    expect(result).toEqual({ total: 0, page: 1, pageSize: 20, items: [] });
    expect(query(0).values).toEqual(["PENDING", "PRO", "%a\\_b\\%%", "%a\\_b\\%%"]);
    expect(query(1).text).toContain('p.amount DESC NULLS LAST, p."createdAt" DESC, p.id ASC');
    expect(query(1).values.slice(-2)).toEqual([20, 0]);
  });

  it("restores payment row order after hydration", async () => {
    mocks.raw.mockResolvedValueOnce([{ total: BigInt(2) }]).mockResolvedValueOnce([{ id: "b" }, { id: "a" }]);
    mocks.payments.mockResolvedValue([{ id: "a" }, { id: "b" }]);
    expect((await listPayments({ page: 1, pageSize: 20 })).items.map((r) => r.id)).toEqual(["b", "a"]);
  });

  it("sorts displayed names and puts absent values last in either direction", () => {
    for (const direction of ["asc", "desc"] as const) {
      expect(userListOrder({ page: 1, pageSize: 20, sort: "package", direction }).text)
        .toContain(`COALESCE(pkg.name, lp."packageCode") ${direction.toUpperCase()} NULLS LAST`);
      expect(paymentListOrder({ page: 1, pageSize: 20, sort: "name", direction }).text)
        .toContain(`LOWER(COALESCE(NULLIF(u.name, ''), u.email)) ${direction.toUpperCase()} NULLS LAST`);
    }
  });

  it("rejects SQL-like sort/direction input and invalid pages at the API boundary", () => {
    for (const schema of [userListQuerySchema, paymentListQuerySchema]) {
      expect(schema.safeParse({ sort: 'name; DROP TABLE users' }).success).toBe(false);
      expect(schema.safeParse({ direction: 'DESC; --' }).success).toBe(false);
      expect(schema.safeParse({ page: 0 }).success).toBe(false);
      expect(schema.safeParse({ pageSize: 101 }).success).toBe(false);
      expect(schema.parse({ page: '2', direction: 'asc' }).page).toBe(2);
    }
  });
});
