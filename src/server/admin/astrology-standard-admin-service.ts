import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { AppError } from "@/lib/errors";
import { writeAudit } from "@/server/audit/audit-service";
import { DEFAULT_STANDARD_GLOSSARY } from "@/lib/astrology-standard-glossary";

function isUniqueConflict(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

type Actor = { id: string; ip?: string };

export type AstrologyStandardInput = {
  matchKey: string;
  term: string;
  group: "มาตรฐานดาว" | "เกณฑ์ประกอบ";
  meaning: string;
  enabled?: boolean;
  sortOrder?: number;
};

export async function seedDefaultAstrologyStandardsIfEmpty() {
  const count = await prisma.astrologyStandardTerm.count();
  if (count > 0) return;
  await prisma.astrologyStandardTerm.createMany({
    data: DEFAULT_STANDARD_GLOSSARY.map((item, index) => ({
      matchKey: item.matchKey,
      term: item.term,
      group: item.group,
      meaning: item.meaning,
      enabled: true,
      sortOrder: index,
    })),
  });
}

export function listAstrologyStandardsAdmin() {
  return prisma.astrologyStandardTerm.findMany({
    orderBy: [{ sortOrder: "asc" }, { term: "asc" }],
  });
}

export function listPublishedAstrologyStandards() {
  return prisma.astrologyStandardTerm.findMany({
    where: { enabled: true },
    orderBy: [{ sortOrder: "asc" }, { term: "asc" }],
    select: {
      matchKey: true,
      term: true,
      group: true,
      meaning: true,
    },
  });
}

export async function createAstrologyStandard(
  input: AstrologyStandardInput,
  actor: Actor,
) {
  try {
    return await prisma.$transaction(async (tx) => {
      const created = await tx.astrologyStandardTerm.create({
        data: {
          matchKey: input.matchKey.trim(),
          term: input.term.trim(),
          group: input.group,
          meaning: input.meaning.trim(),
          enabled: input.enabled ?? true,
          sortOrder: input.sortOrder ?? 0,
        },
      });
      await writeAudit(
        {
          adminUserId: actor.id,
          action: "astrology_standard.create",
          entityType: "astrology_standard_term",
          entityId: created.id,
          after: created,
          ipAddress: actor.ip,
        },
        tx,
      );
      return created;
    });
  } catch (err) {
    if (isUniqueConflict(err)) {
      throw new AppError("DUPLICATE_REQUEST", "คีย์จับคู่นี้มีอยู่แล้ว");
    }
    throw err;
  }
}

export async function updateAstrologyStandard(
  id: string,
  input: AstrologyStandardInput,
  actor: Actor,
) {
  const before = await prisma.astrologyStandardTerm.findUnique({ where: { id } });
  if (!before) throw new AppError("NOT_FOUND", "ไม่พบรายการมาตรฐาน/เกณฑ์นี้");

  try {
    return await prisma.$transaction(async (tx) => {
      const updated = await tx.astrologyStandardTerm.update({
        where: { id },
        data: {
          matchKey: input.matchKey.trim(),
          term: input.term.trim(),
          group: input.group,
          meaning: input.meaning.trim(),
          enabled: input.enabled ?? true,
          sortOrder: input.sortOrder ?? 0,
        },
      });
      await writeAudit(
        {
          adminUserId: actor.id,
          action: "astrology_standard.update",
          entityType: "astrology_standard_term",
          entityId: id,
          before,
          after: updated,
          ipAddress: actor.ip,
        },
        tx,
      );
      return updated;
    });
  } catch (err) {
    if (isUniqueConflict(err)) {
      throw new AppError("DUPLICATE_REQUEST", "คีย์จับคู่นี้มีอยู่แล้ว");
    }
    throw err;
  }
}

export async function deleteAstrologyStandard(id: string, actor: Actor) {
  const before = await prisma.astrologyStandardTerm.findUnique({ where: { id } });
  if (!before) throw new AppError("NOT_FOUND", "ไม่พบรายการมาตรฐาน/เกณฑ์นี้");

  return prisma.$transaction(async (tx) => {
    await tx.astrologyStandardTerm.delete({ where: { id } });
    await writeAudit(
      {
        adminUserId: actor.id,
        action: "astrology_standard.delete",
        entityType: "astrology_standard_term",
        entityId: id,
        before,
        ipAddress: actor.ip,
      },
      tx,
    );
    return { id };
  });
}
