import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { writeAudit } from "@/server/audit/audit-service";
import { bangkokBoundaries } from "@/server/credit/quota-service";
import { thbToUsd, usdToThb, USD_TO_THB } from "@/config/ai-pricing";
import { AppError } from "@/lib/errors";

/**
 * Google does not expose a public API for AI Studio Prepay remaining balance.
 * Admins paste the baht they topped up (or the USD figure from AI Studio);
 * we subtract estimated Gemini spend from AIUsageLog since that snapshot.
 */

export const GEMINI_PREPAID_SETTING_KEY = "gemini_prepaid_balance";
export const AISTUDIO_BILLING_URL = "https://aistudio.google.com/plans";
export const DEFAULT_LOW_THRESHOLD_THB = 50;
export const DEFAULT_LOW_THRESHOLD_USD = thbToUsd(DEFAULT_LOW_THRESHOLD_THB);

export type GeminiPrepaidSnapshot = {
  balanceUsd: number;
  recordedAt: string;
  lowThresholdUsd: number;
  note?: string | null;
  /** Baht actually paid to Google for this top-up round. */
  topUpThb?: number | null;
};

export type GeminiBalanceStatus = "ok" | "low" | "empty" | "untracked";

export type GeminiBalanceView = {
  tracked: boolean;
  balanceAtRecordUsd: number | null;
  recordedAt: string | null;
  lowThresholdUsd: number;
  note: string | null;
  spendSinceUsd: number;
  spendTodayUsd: number;
  spendMonthUsd: number;
  remainingUsd: number | null;
  status: GeminiBalanceStatus;
  usdToThb: number;
  aistudioBillingUrl: string;
  topUpThb: number | null;
  remainingThb: number | null;
  spendSinceThb: number;
  spendTodayThb: number;
  spendMonthThb: number;
  lowThresholdThb: number;
  revenueSinceThb: number;
  profitThb: number;
  profitVsTopUpThb: number | null;
  breakEvenGapThb: number | null;
  readingsSince: number;
};

export type TopUpProfit = {
  profitThb: number;
  profitVsTopUpThb: number | null;
  breakEvenGapThb: number | null;
};

/** Operating profit (cash in − AI spend) and whether the top-up round has paid for itself. */
export function computeTopUpProfit(input: {
  topUpThb: number | null;
  spendSinceThb: number;
  revenueSinceThb: number;
}): TopUpProfit {
  const spend = Math.max(0, input.spendSinceThb);
  const revenue = Math.max(0, input.revenueSinceThb);
  const profitThb = revenue - spend;
  if (input.topUpThb == null || input.topUpThb < 0) {
    return { profitThb, profitVsTopUpThb: null, breakEvenGapThb: null };
  }
  return {
    profitThb,
    profitVsTopUpThb: revenue - input.topUpThb,
    breakEvenGapThb: Math.max(0, input.topUpThb - revenue),
  };
}

/** Pure estimate — unit-tested without Prisma. */
export function computeGeminiBalanceEstimate(input: {
  snapshot: GeminiPrepaidSnapshot | null;
  spendSinceUsd: number;
  spendTodayUsd: number;
  spendMonthUsd: number;
  revenueSinceThb?: number;
  readingsSince?: number;
}): GeminiBalanceView {
  const lowThresholdUsd =
    input.snapshot?.lowThresholdUsd ?? DEFAULT_LOW_THRESHOLD_USD;
  const spendSinceUsd = Math.max(0, input.spendSinceUsd);
  const spendTodayUsd = Math.max(0, input.spendTodayUsd);
  const spendMonthUsd = Math.max(0, input.spendMonthUsd);
  const spendSinceThb = usdToThb(spendSinceUsd);
  const spendTodayThb = usdToThb(spendTodayUsd);
  const spendMonthThb = usdToThb(spendMonthUsd);
  const revenueSinceThb = Math.max(0, input.revenueSinceThb ?? 0);
  const readingsSince = Math.max(0, input.readingsSince ?? 0);

  const emptyEconomics = computeTopUpProfit({
    topUpThb: null,
    spendSinceThb: spendMonthThb,
    revenueSinceThb,
  });

  if (!input.snapshot) {
    return {
      tracked: false,
      balanceAtRecordUsd: null,
      recordedAt: null,
      lowThresholdUsd,
      note: null,
      spendSinceUsd: 0,
      spendTodayUsd,
      spendMonthUsd,
      remainingUsd: null,
      status: "untracked",
      usdToThb: USD_TO_THB,
      aistudioBillingUrl: AISTUDIO_BILLING_URL,
      topUpThb: null,
      remainingThb: null,
      spendSinceThb: 0,
      spendTodayThb,
      spendMonthThb,
      lowThresholdThb: usdToThb(lowThresholdUsd),
      revenueSinceThb,
      readingsSince,
      ...emptyEconomics,
    };
  }

  const remainingUsd = Math.max(0, input.snapshot.balanceUsd - spendSinceUsd);
  let status: GeminiBalanceStatus = "ok";
  if (remainingUsd <= 0) status = "empty";
  else if (remainingUsd <= lowThresholdUsd) status = "low";

  const topUpThb =
    input.snapshot.topUpThb != null && Number.isFinite(input.snapshot.topUpThb)
      ? input.snapshot.topUpThb
      : usdToThb(input.snapshot.balanceUsd);
  const remainingThb = Math.max(0, topUpThb - spendSinceThb);
  const economics = computeTopUpProfit({
    topUpThb,
    spendSinceThb,
    revenueSinceThb,
  });

  return {
    tracked: true,
    balanceAtRecordUsd: input.snapshot.balanceUsd,
    recordedAt: input.snapshot.recordedAt,
    lowThresholdUsd,
    note: input.snapshot.note ?? null,
    spendSinceUsd,
    spendTodayUsd,
    spendMonthUsd,
    remainingUsd,
    status,
    usdToThb: USD_TO_THB,
    aistudioBillingUrl: AISTUDIO_BILLING_URL,
    topUpThb,
    remainingThb,
    spendSinceThb,
    spendTodayThb,
    spendMonthThb,
    lowThresholdThb: usdToThb(lowThresholdUsd),
    revenueSinceThb,
    readingsSince,
    ...economics,
  };
}

function parseSnapshot(raw: unknown): GeminiPrepaidSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const balanceUsd = Number(o.balanceUsd);
  const recordedAt = typeof o.recordedAt === "string" ? o.recordedAt : null;
  if (!Number.isFinite(balanceUsd) || balanceUsd < 0 || !recordedAt) return null;
  const low =
    o.lowThresholdUsd != null ? Number(o.lowThresholdUsd) : DEFAULT_LOW_THRESHOLD_USD;
  const topUpRaw = o.topUpThb != null ? Number(o.topUpThb) : null;
  return {
    balanceUsd,
    recordedAt,
    lowThresholdUsd: Number.isFinite(low) && low >= 0 ? low : DEFAULT_LOW_THRESHOLD_USD,
    note: typeof o.note === "string" ? o.note : o.note === null ? null : null,
    topUpThb:
      topUpRaw != null && Number.isFinite(topUpRaw) && topUpRaw >= 0 ? topUpRaw : null,
  };
}

async function sumGeminiSpendUsd(since: Date): Promise<number> {
  const agg = await prisma.aIUsageLog.aggregate({
    where: {
      provider: "GEMINI",
      status: "SUCCESS",
      createdAt: { gte: since },
      estimatedCost: { not: null },
    },
    _sum: { estimatedCost: true },
  });
  return Number(agg._sum.estimatedCost ?? 0);
}

async function sumApprovedPaymentsThb(since: Date): Promise<number> {
  const agg = await prisma.payment.aggregate({
    where: {
      status: "APPROVED",
      OR: [{ paidAt: { gte: since } }, { paidAt: null, reviewedAt: { gte: since } }],
    },
    _sum: { amount: true },
  });
  return Number(agg._sum.amount ?? 0);
}

async function countBillableReadings(since: Date): Promise<number> {
  return prisma.aIUsageLog.count({
    where: {
      status: "SUCCESS",
      readingId: { not: null },
      createdAt: { gte: since },
    },
  });
}

async function readSnapshot(): Promise<GeminiPrepaidSnapshot | null> {
  const row = await prisma.appSetting.findUnique({
    where: { key: GEMINI_PREPAID_SETTING_KEY },
  });
  return parseSnapshot(row?.valueJson);
}

export async function getGeminiBalance(): Promise<GeminiBalanceView> {
  const snapshot = await readSnapshot();
  const { dayStart, monthStart } = bangkokBoundaries();
  const since = snapshot ? new Date(snapshot.recordedAt) : monthStart;

  const [spendSinceUsd, spendTodayUsd, spendMonthUsd, revenueSinceThb, readingsSince] =
    await Promise.all([
      snapshot ? sumGeminiSpendUsd(since) : Promise.resolve(0),
      sumGeminiSpendUsd(dayStart),
      sumGeminiSpendUsd(monthStart),
      snapshot ? sumApprovedPaymentsThb(since) : sumApprovedPaymentsThb(monthStart),
      snapshot ? countBillableReadings(since) : countBillableReadings(monthStart),
    ]);

  return computeGeminiBalanceEstimate({
    snapshot,
    spendSinceUsd,
    spendTodayUsd,
    spendMonthUsd,
    revenueSinceThb,
    readingsSince,
  });
}

export type GeminiBalanceUpdateInput = {
  /** Baht topped up — preferred. Resets the spend window. */
  balanceThb?: number;
  /** Set a new Prepay snapshot in USD (resets the spend window). Omit to keep balance. */
  balanceUsd?: number;
  /** Wipe tracking. */
  clear?: boolean;
  lowThresholdThb?: number;
  lowThresholdUsd?: number;
  note?: string | null;
};

export async function updateGeminiBalance(
  input: GeminiBalanceUpdateInput,
  admin: { id: string; ip?: string },
): Promise<GeminiBalanceView> {
  const before = await readSnapshot();

  if (input.clear) {
    await prisma.appSetting.deleteMany({
      where: { key: GEMINI_PREPAID_SETTING_KEY },
    });
    await writeAudit({
      adminUserId: admin.id,
      action: "gemini_prepaid.clear",
      entityType: "AppSetting",
      entityId: GEMINI_PREPAID_SETTING_KEY,
      before,
      after: null,
      ipAddress: admin.ip,
    });
    return getGeminiBalance();
  }

  const hasNewBalance = input.balanceThb !== undefined || input.balanceUsd !== undefined;

  if (!before && !hasNewBalance) {
    throw new AppError(
      "VALIDATION",
      "ต้องใส่ยอดที่เติม Gemini ก่อนเริ่มติดตาม",
    );
  }

  const topUpThb =
    input.balanceThb !== undefined
      ? input.balanceThb
      : (before?.topUpThb ??
        (input.balanceUsd !== undefined ? usdToThb(input.balanceUsd) : null));

  const balanceUsd =
    input.balanceThb !== undefined
      ? thbToUsd(input.balanceThb)
      : input.balanceUsd !== undefined
        ? input.balanceUsd
        : (before?.balanceUsd ?? 0);

  const lowThresholdUsd =
    input.lowThresholdThb !== undefined
      ? thbToUsd(input.lowThresholdThb)
      : input.lowThresholdUsd !== undefined
        ? input.lowThresholdUsd
        : (before?.lowThresholdUsd ?? DEFAULT_LOW_THRESHOLD_USD);

  const next: GeminiPrepaidSnapshot = {
    balanceUsd,
    recordedAt: hasNewBalance
      ? new Date().toISOString()
      : (before?.recordedAt ?? new Date().toISOString()),
    lowThresholdUsd,
    note: input.note !== undefined ? input.note : (before?.note ?? null),
    topUpThb,
  };

  await prisma.appSetting.upsert({
    where: { key: GEMINI_PREPAID_SETTING_KEY },
    create: {
      key: GEMINI_PREPAID_SETTING_KEY,
      valueJson: next as unknown as Prisma.InputJsonValue,
    },
    update: {
      valueJson: next as unknown as Prisma.InputJsonValue,
    },
  });

  await writeAudit({
    adminUserId: admin.id,
    action: hasNewBalance ? "gemini_prepaid.set" : "gemini_prepaid.update",
    entityType: "AppSetting",
    entityId: GEMINI_PREPAID_SETTING_KEY,
    before,
    after: next,
    ipAddress: admin.ip,
  });

  return getGeminiBalance();
}
