import type { ActivationSource, Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { writeAudit } from "@/server/audit/audit-service";
import {
  combinePackExpiry,
  expiryFromRule,
  packExpiryRule,
  parsePackExpiryRule,
  type PackExpiryFields,
  type PackExpiryRule,
} from "@/lib/pack-expiry";
import { unitsToQuestions } from "@/lib/usage-budget-display";
import { addPurchasedUsage, expirePurchasedUsage, type UsageLedgerRef } from "@/server/usage/usage-budget-service";

/**
 * Question packs (9 Oct 2026): bought one at a time, the questions add to
 * what is left, and every Pro feature is open while they last. Replaces the
 * monthly Pro for new purchases; a running monthly Pro keeps working.
 */

const DEFAULT_EXPIRY_KEY = "packs.defaultExpiry";

type Db = Prisma.TransactionClient | typeof prisma;

export async function getDefaultPackExpiry(client: Db = prisma): Promise<PackExpiryRule> {
  const row = await client.appSetting.findUnique({ where: { key: DEFAULT_EXPIRY_KEY }, select: { valueJson: true } });
  return parsePackExpiryRule(row?.valueJson);
}

export async function setDefaultPackExpiry(rule: PackExpiryRule, actor: { id: string; ip?: string }) {
  const before = await getDefaultPackExpiry();
  return prisma.$transaction(async (tx) => {
    await tx.appSetting.upsert({
      where: { key: DEFAULT_EXPIRY_KEY },
      create: { key: DEFAULT_EXPIRY_KEY, valueJson: rule as object },
      update: { valueJson: rule as object },
    });
    await writeAudit(
      {
        adminUserId: actor.id,
        action: "package.default_expiry.set",
        entityType: "app_setting",
        entityId: DEFAULT_EXPIRY_KEY,
        before,
        after: rule,
        ipAddress: actor.ip,
      },
      tx,
    );
    return rule;
  });
}

export type QuestionPackRow = PackExpiryFields & {
  id: string;
  code: string;
  usageBudgetUnits: number;
};

/**
 * Add a pack's questions to the purchased pool and open Pro until they end.
 * Call inside the transaction that holds the wallet lock.
 */
export async function applyQuestionPack(
  tx: Prisma.TransactionClient,
  input: {
    userId: string;
    pkg: QuestionPackRow;
    ref: UsageLedgerRef;
    activationSource: ActivationSource;
    now?: Date;
  },
) {
  const now = input.now ?? new Date();
  const { userId, pkg } = input;
  // An ended pool must not lend its date to the new questions.
  await expirePurchasedUsage(userId, tx, now);
  const wallet = await tx.usageWallet.findUnique({
    where: { userId },
    select: { purchasedBalanceUnits: true, purchasedExpiresAt: true },
  });
  const rule = packExpiryRule(pkg, await getDefaultPackExpiry(tx));
  const questionsEnd = combinePackExpiry(
    { balanceUnits: wallet?.purchasedBalanceUnits ?? 0, expiresAt: wallet?.purchasedExpiresAt ?? null },
    expiryFromRule(rule, now),
    now,
  );

  if (pkg.usageBudgetUnits > 0) {
    await addPurchasedUsage(userId, pkg.usageBudgetUnits, input.ref, tx);
  }
  await tx.usageWallet.update({ where: { userId }, data: { purchasedExpiresAt: questionsEnd } });

  // Pro lasts as long as the questions do, and never shorter than a Pro the
  // user already has running (a monthly plan, an admin grant).
  const running = await tx.userSubscription.findMany({
    where: { userId, status: "ACTIVE", package: { type: "PRO" }, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
    select: { expiresAt: true },
  });
  const proEnd =
    questionsEnd === null || running.some((s) => s.expiresAt === null)
      ? null
      : running.reduce<Date>((max, s) => (s.expiresAt! > max ? s.expiresAt! : max), questionsEnd);

  await tx.userSubscription.updateMany({ where: { userId, status: "ACTIVE" }, data: { status: "CANCELLED" } });
  const subscription = await tx.userSubscription.create({
    data: { userId, packageId: pkg.id, status: "ACTIVE", activationSource: input.activationSource, startsAt: now, expiresAt: proEnd },
    select: { id: true, expiresAt: true, package: { select: { code: true } } },
  });
  return {
    subscription,
    questionsAdded: unitsToQuestions(pkg.usageBudgetUnits),
    questionsEnd,
  };
}
