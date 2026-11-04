import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
const url = new URL(process.env.DATABASE_URL ?? "postgresql://invalid/invalid");
if (!["localhost", "127.0.0.1"].includes(url.hostname) || !/^\/hora_admin_filter_test(?:_[a-zA-Z0-9_-]+)?$/.test(url.pathname)) throw Error("Isolated local test DB required");
const db = new PrismaClient({ datasources: { db: { url: url.href } } });
vi.mock("@/server/db", () => ({ get prisma() { return db; } }));
vi.mock("@/server/payment/payment-notify", () => ({ notifyAdminsNewPayment: vi.fn(), notifyUserPaymentReviewed: vi.fn().mockResolvedValue({ ok: true }), persistPaymentNotifyResult: vi.fn() }));
vi.mock("@/server/payment/payment-proof", () => ({ assertOwnedProofPath: vi.fn(), deletePaymentProofBlob: vi.fn() }));
const { reviewPayment } = await import("@/server/payment/payment-service");
const { listPaymentHistory } = await import("@/server/payment/payment-history-service");
const { paymentHistoryQuerySchema } = await import("@/lib/admin-schemas");
const audit = await import("@/server/audit/audit-service");
const prefix = "history-fixture-", admin = prefix + "admin", other = prefix + "other";
let pkgId: string;
const query = (values: object = {}) => paymentHistoryQuerySchema.parse({ search: prefix, ...values });
beforeAll(async () => {
  await db.user.createMany({ data: [{ id: admin, email: `${admin}@example.invalid`, name: "Reviewer Alpha", role: "ADMIN" }, { id: other, email: `${other}@example.invalid`, name: "Reviewer Beta", role: "ADMIN" }, ...Array.from({ length: 10 }, (_, n) => ({ id: prefix + n, email: `${prefix}${n}@example.invalid`, name: "Member original" }))] });
  pkgId = (await db.package.create({ data: { code: prefix + "pack", name: "Original 40", price: 50, type: "PRO", questionPack: true, creditQuota: 77, usageBudgetUnits: 600000, expiryMode: "DAYS", expiryDays: 30 } })).id;
});
beforeEach(async () => {
  await db.package.update({ where: { id: pkgId }, data: { name: "Original 40", price: 50, usageBudgetUnits: 600000, expiryMode: "DAYS", expiryDays: 30 } });
  await db.user.update({ where: { id: admin }, data: { name: "Reviewer Alpha" } });
});
afterAll(async () => {
  await db.adminAuditLog.deleteMany({ where: { adminUserId: { startsWith: prefix } } });
  await db.user.deleteMany({ where: { id: { startsWith: prefix } } });
  await db.package.deleteMany({ where: { code: { startsWith: prefix } } });
  await db.$disconnect();
});
async function payment(n: number, code = prefix + "pack") {
  return db.payment.create({ data: { id: prefix + `pay-${n}`, userId: prefix + n, amount: 50, packageCode: code, transferredAt: new Date("2026-11-04T05:00Z") } });
}

describe("payment receipts and history against PostgreSQL", () => {
  it("freezes actual granted questions, effective expiry, names and note despite later catalog/profile changes", async () => {
    const p = await payment(0);
    const oldEnd = new Date(Date.now() + 90 * 86400000);
    await db.usageWallet.create({ data: { userId: p.userId, purchasedBalanceUnits: 150000, purchasedExpiresAt: oldEnd } });
    await reviewPayment(p.id, { status: "APPROVED", note: "Verified original transfer" }, { id: admin });
    const row = (await listPaymentHistory(query())).items.find(x => x.id === p.id)!;
    expect(row.receipt).toMatchObject({ packageName: "Original 40", questionsAdded: 40, creditsAdded: 0, expiryRule: { mode: "DAYS", days: 30 }, expiresAt: oldEnd.toISOString() });
    expect(row.receipt?.startsAt).toBeTruthy();
    await db.package.update({ where: { id: pkgId }, data: { name: "Changed 90", usageBudgetUnits: 1350000, expiryDays: 180, price: 99 } });
    await db.user.update({ where: { id: p.userId }, data: { name: "Renamed member", email: `${prefix}renamed@example.invalid` } });
    await db.user.update({ where: { id: admin }, data: { name: "Renamed reviewer" } });
    await db.usageWallet.update({ where: { userId: p.userId }, data: { purchasedExpiresAt: new Date(Date.now() + 365 * 86400000) } });
    const wallet = await db.usageWallet.findUniqueOrThrow({ where: { userId: p.userId } });
    const again = (await listPaymentHistory(query())).items.find(x => x.id === p.id)!;
    expect(again).toEqual(row);
    expect(again.member.name).toBe("Member original"); expect(again.reviewer?.name).toBe("Reviewer Alpha");
    expect((await listPaymentHistory(query({ search: `${prefix}0@example.invalid` }))).items).toHaveLength(1);
    expect(await db.usageWallet.findUniqueOrThrow({ where: { userId: p.userId } })).toEqual(wallet);
    expect(JSON.stringify(again)).not.toContain("proofUrl"); expect(JSON.stringify(again)).not.toContain("ipAddress");
    await db.package.update({ where: { id: pkgId }, data: { price: 50 } });
  });
  it("rejection records reviewer/reason and zero grants; old rows never use today's package rules", async () => {
    const p = await payment(1);
    await reviewPayment(p.id, { status: "REJECTED", note: "Transfer amount does not match" }, { id: other });
    const row = (await listPaymentHistory(query({ status: "REJECTED", reviewerId: other }))).items[0];
    expect(row).toMatchObject({ id: p.id, status: "REJECTED", note: "Transfer amount does not match", receipt: { kind: "REJECTED", questionsAdded: 0, startsAt: null, expiresAt: null, expiryRule: null } });
    expect(await db.usageWallet.findUnique({ where: { userId: p.userId } })).toBeNull();
    await db.payment.create({ data: { id: prefix + "legacy", userId: prefix + 2, amount: 10, packageCode: prefix + "pack", status: "APPROVED", reviewedByAdminId: admin, reviewedAt: new Date() } });
    expect((await listPaymentHistory(query())).items.find(x => x.id.endsWith("legacy"))?.receipt).toBeNull();
  });
  it("filters by Bangkok review day, member snapshot, admin and status with stable pagination", async () => {
    await db.payment.createMany({ data: [
      { id: prefix + "day-in", userId: prefix + 3, amount: 50, status: "APPROVED", reviewedByAdminId: other, reviewedAt: new Date("2026-11-03T17:00:00Z") },
      { id: prefix + "day-out", userId: prefix + 3, amount: 50, status: "APPROVED", reviewedByAdminId: other, reviewedAt: new Date("2026-11-04T17:00:00Z") },
    ] });
    const result = await listPaymentHistory(query({ search: prefix + "day-", from: "2026-11-04", to: "2026-11-04", reviewerId: other, status: "APPROVED" }));
    expect(result.items.map(x => x.id)).toEqual([prefix + "day-in"]);
    expect((await listPaymentHistory(query({ search: "%_" }))).total).toBe(0);
    const page = await listPaymentHistory(query({ page: 999, pageSize: 1 }));
    expect(page.page).toBe(page.total); expect(page.items).toHaveLength(1);
  });
  it("concurrent approvals grant once and create a single immutable receipt", async () => {
    const p = await payment(4);
    const results = await Promise.allSettled([reviewPayment(p.id, { status: "APPROVED" }, { id: admin }), reviewPayment(p.id, { status: "APPROVED" }, { id: other })]);
    expect(results.filter(x => x.status === "fulfilled")).toHaveLength(1);
    expect(await db.adminAuditLog.count({ where: { entityId: p.id, action: "payment.approve" } })).toBe(1);
    expect((await db.usageWallet.findUniqueOrThrow({ where: { userId: p.userId } })).purchasedBalanceUnits).toBe(600000);
  });
  it("rolls back payment and granted questions if the audit receipt cannot be persisted", async () => {
    const p = await payment(5);
    const spy = vi.spyOn(audit, "writeAudit").mockRejectedValueOnce(new Error("Receipt persistence fixture failure"));
    try {
      await expect(reviewPayment(p.id, { status: "APPROVED" }, { id: admin })).rejects.toThrow("Receipt persistence fixture failure");
      expect((await db.payment.findUniqueOrThrow({ where: { id: p.id } })).status).toBe("PENDING");
      expect(await db.usageWallet.findUnique({ where: { userId: p.userId } })).toBeNull();
      expect(await db.adminAuditLog.count({ where: { entityId: p.id } })).toBe(0);
    } finally { spy.mockRestore(); }
  });
  it("freezes the resolved site default and distinguishes an unlimited pool from a 30-day pack", async () => {
    await db.package.update({ where: { id: pkgId }, data: { expiryMode: "DEFAULT" } });
    await db.appSetting.upsert({ where: { key: "packs.defaultExpiry" }, create: { key: "packs.defaultExpiry", valueJson: { mode: "DAYS", days: 45 } }, update: { valueJson: { mode: "DAYS", days: 45 } } });
    const p = await payment(6);
    await db.usageWallet.create({ data: { userId: p.userId, purchasedBalanceUnits: 15000, purchasedExpiresAt: null } });
    try {
      await reviewPayment(p.id, { status: "APPROVED" }, { id: admin });
      await db.appSetting.update({ where: { key: "packs.defaultExpiry" }, data: { valueJson: { mode: "DAYS", days: 365 } } });
      const row = (await listPaymentHistory(query())).items.find(x => x.id === p.id)!;
      expect(row.receipt).toMatchObject({ expiryRule: { mode: "DAYS", days: 45 }, expiresAt: null });
    } finally { await db.appSetting.deleteMany({ where: { key: "packs.defaultExpiry" } }); }
  });
  it("records a monthly renewal's added days separately from the preserved remaining membership", async () => {
    const pkg = await db.package.create({ data: { code: prefix + "monthly", name: "Monthly original", price: 50, type: "PRO", usageBudgetUnits: 600000 } });
    const p = await payment(7, pkg.code), oldEnd = new Date(Date.now() + 20 * 86400000);
    await db.usageWallet.create({ data: { userId: p.userId, includedBalanceUnits: 150000, periodEndsAt: oldEnd } });
    await db.userSubscription.create({ data: { userId: p.userId, packageId: pkg.id, status: "ACTIVE", startsAt: new Date(), expiresAt: oldEnd } });
    await reviewPayment(p.id, { status: "APPROVED" }, { id: admin });
    const row = (await listPaymentHistory(query())).items.find(x => x.id === p.id)!;
    expect(row.receipt).toMatchObject({ kind: "SUBSCRIPTION", questionsAdded: 40, expiryRule: { mode: "DAYS", days: 30 } });
    expect(new Date(row.receipt!.expiresAt!).getTime() - oldEnd.getTime()).toBe(30 * 86400000);
    expect((await db.usageWallet.findUniqueOrThrow({ where: { userId: p.userId } })).includedBalanceUnits).toBe(750000);
  });
  it("records a usage top-up without inventing extra subscription days", async () => {
    const pkg = await db.package.create({ data: { code: prefix + "topup", name: "Usage top-up", price: 50, type: "PRO", creditOnly: true, usageBudgetUnits: 150000 } });
    const p = await payment(8, pkg.code), oldEnd = new Date(Date.now() + 60 * 86400000);
    await db.usageWallet.create({ data: { userId: p.userId, purchasedBalanceUnits: 300000, purchasedExpiresAt: oldEnd } });
    await reviewPayment(p.id, { status: "APPROVED" }, { id: admin });
    const row = (await listPaymentHistory(query())).items.find(x => x.id === p.id)!;
    expect(row.receipt).toMatchObject({ kind: "USAGE_TOPUP", questionsAdded: 10, expiryRule: { mode: "INHERIT" }, expiresAt: oldEnd.toISOString() });
    expect(await db.userSubscription.count({ where: { userId: p.userId } })).toBe(0);
    expect((await db.usageWallet.findUniqueOrThrow({ where: { userId: p.userId } })).purchasedBalanceUnits).toBe(450000);
  });
  it("identifies an allowed Super Admin self-review explicitly in history", async () => {
    const owner = prefix + 9;
    await db.user.update({ where: { id: owner }, data: { role: "SUPER_ADMIN" } });
    const p = await payment(9);
    await reviewPayment(p.id, { status: "APPROVED" }, { id: owner });
    const row = (await listPaymentHistory(query({ reviewerId: owner }))).items[0];
    expect(row.selfReview).toBe(true); expect(row.member.id).toBe(owner); expect(row.reviewer?.id).toBe(owner);
  });
});
