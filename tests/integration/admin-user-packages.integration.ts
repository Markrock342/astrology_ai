import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";

// Fail closed: this test may only use an explicitly named local test database.
const url = new URL(process.env.DATABASE_URL ?? "postgresql://invalid/invalid");
if (!["127.0.0.1", "localhost"].includes(url.hostname)
  || !/^\/hora_admin_filter_test(?:_[a-zA-Z0-9_-]+)?$/.test(url.pathname)
  || [...url.searchParams.keys()].some((key) => !["schema", "connection_limit", "pool_timeout"].includes(key))) {
  throw new Error("Set DATABASE_URL to an isolated local hora_admin_filter_test database, migrated beforehand");
}
const db = new PrismaClient({ datasources: { db: { url: url.href } } });
vi.mock("@/server/db", () => ({ get prisma() { return db; } }));
const { listUsers } = await import("@/server/admin/user-admin-service");
const { getUserExpiry, setUserExpiry } = await import("@/server/admin/user-expiry-service");
const now = new Date("2026-11-02T12:00:00.000Z");
const past = new Date(now.getTime() - 86400000);
const future = new Date(now.getTime() + 86400000);
const prefix = "current-package-regression-";
let freeId: string, plusId: string, liteId: string;

async function user(name: string, options: {
  subs?: Array<{ packageId: string; expiresAt: Date | null; status?: "ACTIVE" | "CANCELLED" | "EXPIRED" }>;
  purchase?: string;
  disabled?: boolean;
} = {}) {
  const id = prefix + name;
  await db.user.create({ data: {
    id, name: id, email: `${id}@example.invalid`, status: options.disabled ? "DISABLED" : "ACTIVE",
    subscriptions: { create: (options.subs ?? []).map((s) => ({ ...s, status: s.status ?? "ACTIVE" })) },
    ...(options.purchase ? { payments: { create: { amount: 99, status: "APPROVED", packageCode: options.purchase, paidAt: past } } } : {}),
  } });
  return id;
}
const list = (packageCode?: string, extra = {}) => listUsers({ page: 1, pageSize: 100, search: prefix, packageCode, ...extra });

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(now);
  freeId = (await db.package.upsert({ where: { code: "FREE" }, create: { code: "FREE", name: "Free", type: "FREE" }, update: {} })).id;
  plusId = (await db.package.create({ data: { code: "FILTER_PLUS", name: "Filter Plus", type: "PRO" } })).id;
  liteId = (await db.package.create({ data: { code: "FILTER_LITE", name: "Filter Lite", type: "PRO" } })).id;
  await user("new-no-subscription");
  await user("new-free-subscription", { subs: [{ packageId: freeId, expiresAt: null }] });
  await user("expired-paid", { purchase: "FILTER_PLUS", subs: [{ packageId: plusId, expiresAt: past }] });
  await user("expiry-boundary", { purchase: "FILTER_PLUS", subs: [{ packageId: plusId, expiresAt: now }] });
  await user("cancelled", { purchase: "FILTER_PLUS", subs: [{ packageId: plusId, expiresAt: future, status: "CANCELLED" }] });
  await user("expired-status", { subs: [{ packageId: plusId, expiresAt: future, status: "EXPIRED" }] });
  await user("manual-free-after-purchase", { purchase: "FILTER_PLUS", subs: [{ packageId: freeId, expiresAt: null }] });
  await user("disabled-free", { disabled: true });
  await user("active-manual", { subs: [{ packageId: plusId, expiresAt: future }] });
  await user("lifetime", { subs: [{ packageId: plusId, expiresAt: null }] });
  await user("live-plan-differs-from-purchase", { purchase: "FILTER_LITE", subs: [{ packageId: plusId, expiresAt: future }] });
  await user("active-with-free-row", { subs: [{ packageId: freeId, expiresAt: null }, { packageId: liteId, expiresAt: future }] });
  await user("renewed-as-lite", { purchase: "FILTER_PLUS", subs: [{ packageId: plusId, expiresAt: past }, { packageId: liteId, expiresAt: future }] });
  await user("duplicate-active", { subs: [{ packageId: plusId, expiresAt: future }, { packageId: plusId, expiresAt: null }] });
}, 30000);

afterAll(async () => {
  vi.useRealTimers();
  await db.adminAuditLog.deleteMany({ where: { adminUserId: { startsWith: prefix } } });
  await db.user.deleteMany({ where: { id: { startsWith: prefix } } });
  await db.package.deleteMany({ where: { code: { in: ["FILTER_PLUS", "FILTER_LITE"] } } });
  await db.$disconnect();
});

describe("expiry editor persistence against real PostgreSQL", () => {
  it("saves dated and indefinite expiry for Free with purchased questions and Pro, without changing credits", async () => {
    const adminId=await user("expiry-admin");
    await db.user.update({where:{id:adminId},data:{role:"ADMIN"}});
    try{for(const pro of [false,true]){
      const id=await user(`expiry-${pro?"pro":"free-purchased"}`,{subs:[{packageId:pro?plusId:freeId,expiresAt:null}]});
      await db.usageWallet.create({data:{userId:id,includedBalanceUnits:300,purchasedBalanceUnits:1000,includedAllowanceUnits:500,purchasedAllowanceUnits:1000}});
      const before=await db.usageWallet.findUniqueOrThrow({where:{userId:id}});
      for(const expiresAt of [new Date("2099-11-07T16:59:59Z"),null]){
        const state=await getUserExpiry(id);expect(state.canEdit).toBe(true);
        await setUserExpiry(id,{expiresAt,reason:"Expiry regression",revision:state.revision},{id:adminId});
        expect((await getUserExpiry(id)).expiresAt).toEqual(expiresAt);
        const after=await db.usageWallet.findUniqueOrThrow({where:{userId:id}});
        for(const key of ["includedBalanceUnits","purchasedBalanceUnits","includedAllowanceUnits","purchasedAllowanceUnits"] as const)expect(after[key]).toBe(before[key]);
        expect(after.purchasedExpiresAt).toEqual(expiresAt);
        const sub=await db.userSubscription.findFirstOrThrow({where:{userId:id}});
        expect(sub.expiresAt).toEqual(pro?expiresAt:null);
        expect(await db.userSubscription.count({where:{userId:id}})).toBe(1);
      }
      expect(await db.adminAuditLog.count({where:{entityId:id,action:"user.expiry.set"}})).toBe(2);
      expect(await db.usageTransaction.count({where:{userId:id}})).toBe(0);
      const stale=await getUserExpiry(id);
      await db.usageWallet.update({where:{userId:id},data:{version:{increment:1}}});
      await expect(setUserExpiry(id,{expiresAt:null,reason:"Stale form",revision:stale.revision},{id:adminId})).rejects.toThrow(/เปลี่ยนแล้ว/);
      const fresh=await getUserExpiry(id),wallet=await db.usageWallet.findUniqueOrThrow({where:{userId:id}});
      await expect(setUserExpiry(id,{expiresAt:new Date("2099-12-01T16:59:59Z"),reason:"Audit rollback",revision:fresh.revision},{id:"nonexistent-admin"})).rejects.toThrow();
      expect(await db.usageWallet.findUniqueOrThrow({where:{userId:id}})).toEqual(wallet);
      expect((await getUserExpiry(id)).expiresAt).toBeNull();
    }}finally{
      await db.adminAuditLog.deleteMany({where:{adminUserId:adminId}});
      await db.user.deleteMany({where:{id:{in:[adminId,prefix+"expiry-pro",prefix+"expiry-free-purchased"]}}});
    }
  });
});

describe("current package filters against real PostgreSQL", () => {
  it("reproduces the original payment-history bug: no Free payments, despite 8 current Free users", async () => {
    const old = await db.$queryRaw<Array<{ total: bigint }>>`
      SELECT COUNT(*) AS total FROM users u LEFT JOIN LATERAL (
        SELECT p."packageCode" FROM payments p WHERE p."userId" = u.id AND p.status = 'APPROVED'
        ORDER BY p."paidAt" DESC NULLS LAST, p."createdAt" DESC, p.id DESC LIMIT 1
      ) lp ON TRUE WHERE u.id LIKE ${prefix + "%"} AND lp."packageCode" = 'FREE'`;
    expect(Number(old[0].total)).toBe(0);
    expect((await list("FREE")).total).toBe(8);
  });
  it("Free includes new sign-ups and expired/cancelled packages, even with a paid purchase history", async () => {
    const result = await list("FREE");
    expect(result.total).toBe(8);
    expect(result.items.map((u) => u.id).sort()).toEqual([
      "new-no-subscription", "new-free-subscription", "expired-paid", "expiry-boundary", "cancelled", "expired-status", "manual-free-after-purchase", "disabled-free",
    ].map((name) => prefix + name).sort());
  });
  it("a paid package follows live access, including manually granted and lifetime access", async () => {
    const result = await list("FILTER_PLUS");
    expect(result.total).toBe(4);
    expect(result.items.map((u) => u.id).sort()).toEqual([
      "active-manual", "lifetime", "live-plan-differs-from-purchase", "duplicate-active",
    ].map((name) => prefix + name).sort());
  });
  it("a past package does not match when the user's current package is different", async () => {
    expect((await list("FILTER_LITE")).items.map((u) => u.id).sort()).toEqual([
      prefix + "active-with-free-row", prefix + "renewed-as-lite",
    ].sort());
  });
  it("uses the same filter for totals and pagination and combines it with account status", async () => {
    const result = await list("FREE", { page: 99, pageSize: 3, status: "ACTIVE" });
    expect(result.total).toBe(7);
    expect(result.page).toBe(3);
    expect(result.items).toHaveLength(1);
    expect(result.items.every((u) => u.status === "ACTIVE")).toBe(true);
  });
  it("keeps historical purchases visible without making them the current plan", async () => {
    const result = await list("FREE");
    const expired = result.items.find((u) => u.id === prefix + "expired-paid");
    expect(expired?.latestPurchase?.packageCode).toBe("FILTER_PLUS");
    expect(expired?.subscriptions).toEqual([]);
  });
  it("does not duplicate users with multiple live rows; unfiltered pagination still finds everyone", async () => {
    const result = await list();
    expect(result.total).toBe(14);
    expect(new Set(result.items.map((u) => u.id)).size).toBe(14);
  });
});
