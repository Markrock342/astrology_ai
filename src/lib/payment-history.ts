import { z } from "zod";

const identity = z.object({ id: z.string(), name: z.string().nullable(), email: z.string() });
export const paymentReceiptSchema = z.object({
  version: z.literal(1),
  member: identity,
  reviewer: identity,
  packageCode: z.string().nullable(),
  packageName: z.string().nullable(),
  amount: z.number().int().nonnegative(),
  decision: z.enum(["APPROVED", "REJECTED"]),
  kind: z.enum(["QUESTION_PACK", "SUBSCRIPTION", "USAGE_TOPUP", "REJECTED"]),
  questionsAdded: z.number().nonnegative(),
  creditsAdded: z.number().nonnegative(),
  startsAt: z.string().datetime().nullable(),
  expiresAt: z.string().datetime().nullable(),
  expiryRule: z.discriminatedUnion("mode", [
    z.object({ mode: z.literal("NONE") }),
    z.object({ mode: z.literal("INHERIT") }),
    z.object({ mode: z.literal("DAYS"), days: z.number().int().positive() }),
    z.object({ mode: z.literal("DATE"), date: z.string().datetime() }),
  ]).nullable(),
  note: z.string().nullable(),
});
export type PaymentReceipt = z.infer<typeof paymentReceiptSchema>;
export type PaymentHistoryItem = {
  id: string; reviewedAt: string | null; submittedAt: string; transferredAt: string | null;
  member: { id: string; name: string | null; email: string };
  reviewer: { id: string; name: string | null; email: string } | null;
  status: "APPROVED" | "REJECTED"; amount: number; packageCode: string | null;
  note: string | null; selfReview: boolean; receipt: PaymentReceipt | null;
};
export type PaymentHistoryList = {
  items: PaymentHistoryItem[]; page: number; pageSize: number; total: number;
  reviewers: Array<{ id: string; name: string | null; email: string }>;
};
