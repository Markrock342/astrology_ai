import type { Prisma, AIProvider, UsageStatus } from "@prisma/client";
import { prisma } from "@/server/db";
import { estimateCostUsd } from "@/config/ai-pricing";

/**
 * Writes an ai_usage_logs row for EVERY attempt (success and failure) so the
 * admin dashboard can track cost/latency/errors (spec 6.9). Called from the
 * router; safe to call outside the credit transaction since logging must never
 * affect billing.
 */
export type UsageLogInput = {
  readingId?: string;
  userId: string;
  provider: AIProvider;
  modelId: string;
  status: UsageStatus;
  inputUsage?: number;
  outputUsage?: number;
  /** Subset of inputUsage served from cache — billed at 10%. Not persisted
   *  (no column), but it does change the cost we record. */
  cachedUsage?: number;
  /** Omit to derive it from the token counts at the model's current price. */
  estimatedCost?: number;
  latencyMs?: number;
  errorCode?: string;
  errorMessage?: string;
};

export async function logUsage(
  input: UsageLogInput,
  client: Prisma.TransactionClient | typeof prisma = prisma,
) {
  // The column has existed since day one and nobody ever wrote to it, so every
  // "cost" the admin panel showed was blank. Price the call here, at the rate in
  // force when it happened — that is what makes it an accounting record rather
  // than a number that silently rewrites itself when Google changes its list.
  const hasTokens =
    input.inputUsage != null || input.outputUsage != null;
  const estimatedCost =
    input.estimatedCost ??
    (hasTokens
      ? estimateCostUsd(
          input.modelId,
          input.inputUsage,
          input.outputUsage,
          input.cachedUsage,
        )
      : undefined);

  return client.aIUsageLog.create({
    data: {
      readingId: input.readingId,
      userId: input.userId,
      provider: input.provider,
      modelId: input.modelId,
      status: input.status,
      inputUsage: input.inputUsage,
      outputUsage: input.outputUsage,
      estimatedCost,
      latencyMs: input.latencyMs,
      errorCode: input.errorCode,
      errorMessage: input.errorMessage,
    },
  });
}
