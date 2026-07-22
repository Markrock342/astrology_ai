import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { writeAudit } from "@/server/audit/audit-service";
import { bangkokBoundaries } from "@/server/credit/quota-service";
import { USD_TO_THB } from "@/config/ai-pricing";
import { AppError } from "@/lib/errors";

/**
 * Google does not expose a public API for AI Studio Prepay remaining balance.
 * Admins paste the current balance from https://aistudio.google.com/plans;
 * we subtract estimated Gemini spend from AIUsageLog since that snapshot.
 */

export const GEMINI_PREPAID_SETTING_KEY = "gemini_prepaid_balance";
export const AISTUDIO_BILLING_URL = "https://aistudio.google.com/plans";
export const DEFAULT_LOW_THRESHOLD_USD = 10;

export type GeminiPrepaidSnapshot = {
  balanceUsd: number;
  recordedAt: string;
  lowThresholdUsd: number;
  note?: string | null;
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
};

/** Pure estimate — unit-tested without Prisma. */
export function computeGeminiBalanceEstimate(input: {
  snapshot: GeminiPrepaidSnapshot | null;
  spendSinceUsd: number;
  spendTodayUsd: number;
  spendMonthUsd: number;
}): GeminiBalanceView {
  const lowThresholdUsd =
    input.snapshot?.lowThresholdUsd ?? DEFAULT_LOW_THRESHOLD_USD;
  const spendSinceUsd = Math.max(0, input.spendSinceUsd);
  const spendTodayUsd = Math.max(0, input.spendTodayUsd);
  const spendMonthUsd = Math.max(0, input.spendMonthUsd);

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
    };
  }

  const remainingUsd = Math.max(0, input.snapshot.balanceUsd - spendSinceUsd);
  let status: GeminiBalanceStatus = "ok";
  if (remainingUsd <= 0) status = "empty";
  else if (remainingUsd <= lowThresholdUsd) status = "low";

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
  return {
    balanceUsd,
    recordedAt,
    lowThresholdUsd: Number.isFinite(low) && low >= 0 ? low : DEFAULT_LOW_THRESHOLD_USD,
    note: typeof o.note === "string" ? o.note : o.note === null ? null : null,
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

  const [spendSinceUsd, spendTodayUsd, spendMonthUsd] = await Promise.all([
    snapshot ? sumGeminiSpendUsd(since) : Promise.resolve(0),
    sumGeminiSpendUsd(dayStart),
    sumGeminiSpendUsd(monthStart),
  ]);

  return computeGeminiBalanceEstimate({
    snapshot,
    spendSinceUsd,
    spendTodayUsd,
    spendMonthUsd,
  });
}

export type GeminiBalanceUpdateInput = {
  /** Set a new Prepay snapshot (resets the spend window). Omit to keep balance. */
  balanceUsd?: number;
  /** Wipe tracking. */
  clear?: boolean;
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

  if (!before && input.balanceUsd === undefined) {
    throw new AppError(
      "VALIDATION",
      "ต้องใส่ยอดคงเหลือจาก AI Studio ก่อนเริ่มติดตาม",
    );
  }

  const next: GeminiPrepaidSnapshot = {
    balanceUsd:
      input.balanceUsd !== undefined
        ? input.balanceUsd
        : (before?.balanceUsd ?? 0),
    recordedAt:
      input.balanceUsd !== undefined
        ? new Date().toISOString()
        : (before?.recordedAt ?? new Date().toISOString()),
    lowThresholdUsd:
      input.lowThresholdUsd ??
      before?.lowThresholdUsd ??
      DEFAULT_LOW_THRESHOLD_USD,
    note: input.note !== undefined ? input.note : (before?.note ?? null),
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
    action:
      input.balanceUsd !== undefined
        ? "gemini_prepaid.set"
        : "gemini_prepaid.update",
    entityType: "AppSetting",
    entityId: GEMINI_PREPAID_SETTING_KEY,
    before,
    after: next,
    ipAddress: admin.ip,
  });

  return getGeminiBalance();
}
