import type { ContentEntityType, RevisionAction } from "@prisma/client";
import { prisma } from "@/server/db";

type Actor = { id: string };

export type RevisionRow = {
  id: string;
  entityType: ContentEntityType;
  entityId: string;
  version: number;
  snapshotJson?: unknown;
  action: RevisionAction;
  note: string | null;
  createdAt: Date;
  admin: { email: string; name: string | null };
};

async function nextRevisionVersion(entityType: ContentEntityType, entityId: string) {
  const latest = await prisma.contentRevision.findFirst({
    where: { entityType, entityId },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  return (latest?.version ?? 0) + 1;
}

export async function recordRevision(input: {
  entityType: ContentEntityType;
  entityId: string;
  snapshotJson: unknown;
  action: RevisionAction;
  actor: Actor;
  note?: string;
}) {
  const version = await nextRevisionVersion(input.entityType, input.entityId);
  return prisma.contentRevision.create({
    data: {
      entityType: input.entityType,
      entityId: input.entityId,
      version,
      snapshotJson: input.snapshotJson as object,
      adminUserId: input.actor.id,
      action: input.action,
      note: input.note,
    },
  });
}

export async function listRevisions(
  entityType: ContentEntityType,
  entityId: string,
  limit = 30,
): Promise<RevisionRow[]> {
  return prisma.contentRevision.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      entityType: true,
      entityId: true,
      version: true,
      action: true,
      note: true,
      createdAt: true,
      admin: { select: { email: true, name: true } },
    },
  }) as Promise<RevisionRow[]>;
}

export async function getRevision(id: string) {
  return prisma.contentRevision.findUnique({
    where: { id },
    include: { admin: { select: { email: true, name: true } } },
  });
}
