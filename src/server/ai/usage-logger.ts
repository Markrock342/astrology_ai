import type { Prisma, AIProvider, UsageStatus } from "@prisma/client";
import { prisma } from "@/server/db";

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
  estimatedCost?: number;
  latencyMs?: number;
  errorCode?: string;
  errorMessage?: string;
};

export async function logUsage(
  input: UsageLogInput,
  client: Prisma.TransactionClient | typeof prisma = prisma,
) {
  return client.aIUsageLog.create({
    data: {
      readingId: input.readingId,
      userId: input.userId,
      provider: input.provider,
      modelId: input.modelId,
      status: input.status,
      inputUsage: input.inputUsage,
      outputUsage: input.outputUsage,
      estimatedCost: input.estimatedCost,
      latencyMs: input.latencyMs,
      errorCode: input.errorCode,
      errorMessage: input.errorMessage,
    },
  });
}
