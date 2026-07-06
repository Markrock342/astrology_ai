import type { AnnouncementTone, Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { AppError } from "@/lib/errors";
import { writeAudit } from "@/server/audit/audit-service";
import { recordRevision } from "@/server/admin/content-revision-service";

type Actor = { id: string; ip?: string };

// ---- Site announcements -----------------------------------------------------

export type AnnouncementInput = {
  title: string;
  message: string;
  tone?: AnnouncementTone;
  enabled?: boolean;
  linkUrl?: string | null;
  linkLabel?: string | null;
  startsAt?: Date | null;
  endsAt?: Date | null;
  sortOrder?: number;
};

export function listAnnouncements() {
  return prisma.siteAnnouncement.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });
}

export async function createAnnouncement(input: AnnouncementInput, actor: Actor) {
  return prisma.$transaction(async (tx) => {
    const created = await tx.siteAnnouncement.create({
      data: input as Prisma.SiteAnnouncementUncheckedCreateInput,
    });
    await writeAudit(
      {
        adminUserId: actor.id,
        action: "announcement.create",
        entityType: "site_announcement",
        entityId: created.id,
        after: created,
        ipAddress: actor.ip,
      },
      tx,
    );
    return created;
  });
}

export async function updateAnnouncement(id: string, input: Partial<AnnouncementInput>, actor: Actor) {
  const before = await prisma.siteAnnouncement.findUnique({ where: { id } });
  if (!before) throw new AppError("NOT_FOUND", "Announcement not found");

  return prisma.$transaction(async (tx) => {
    const updated = await tx.siteAnnouncement.update({
      where: { id },
      data: input as Prisma.SiteAnnouncementUncheckedUpdateInput,
    });
    await writeAudit(
      {
        adminUserId: actor.id,
        action: "announcement.update",
        entityType: "site_announcement",
        entityId: id,
        before,
        after: updated,
        ipAddress: actor.ip,
      },
      tx,
    );
    return updated;
  });
}

export async function deleteAnnouncement(id: string, actor: Actor) {
  const before = await prisma.siteAnnouncement.findUnique({ where: { id } });
  if (!before) throw new AppError("NOT_FOUND", "Announcement not found");

  return prisma.$transaction(async (tx) => {
    await tx.siteAnnouncement.delete({ where: { id } });
    await writeAudit(
      {
        adminUserId: actor.id,
        action: "announcement.delete",
        entityType: "site_announcement",
        entityId: id,
        before,
        ipAddress: actor.ip,
      },
      tx,
    );
    return { id };
  });
}

// ---- FAQ --------------------------------------------------------------------

export type FaqInput = {
  question: string;
  answer: string;
  category?: string;
  enabled?: boolean;
  sortOrder?: number;
};

export function listFaqItemsAdmin() {
  return prisma.faqItem.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

export async function createFaqItem(input: FaqInput, actor: Actor) {
  return prisma.$transaction(async (tx) => {
    const created = await tx.faqItem.create({ data: input });
    await writeAudit(
      {
        adminUserId: actor.id,
        action: "faq.create",
        entityType: "faq_item",
        entityId: created.id,
        after: created,
        ipAddress: actor.ip,
      },
      tx,
    );
    return created;
  });
}

export async function saveFaqDraft(id: string, input: FaqInput, actor: Actor) {
  const item = await prisma.faqItem.findUnique({ where: { id } });
  if (!item) throw new AppError("NOT_FOUND", "FAQ item not found");

  const updated = await prisma.faqItem.update({
    where: { id },
    data: {
      draftQuestion: input.question,
      draftAnswer: input.answer,
      draftUpdatedAt: new Date(),
      draftUpdatedById: actor.id,
    },
  });

  await recordRevision({
    entityType: "FAQ_ITEM",
    entityId: id,
    snapshotJson: { question: input.question, answer: input.answer, category: item.category },
    action: "DRAFT_SAVE",
    actor,
  });

  return updated;
}

export async function publishFaqItem(id: string, input: FaqInput, actor: Actor) {
  const before = await prisma.faqItem.findUnique({ where: { id } });
  if (!before) throw new AppError("NOT_FOUND", "FAQ item not found");

  const updated = await prisma.faqItem.update({
    where: { id },
    data: {
      question: input.question,
      answer: input.answer,
      category: input.category ?? before.category,
      enabled: input.enabled ?? before.enabled,
      sortOrder: input.sortOrder ?? before.sortOrder,
      draftQuestion: null,
      draftAnswer: null,
      draftUpdatedAt: null,
      draftUpdatedById: null,
    },
  });

  await recordRevision({
    entityType: "FAQ_ITEM",
    entityId: id,
    snapshotJson: {
      question: updated.question,
      answer: updated.answer,
      category: updated.category,
    },
    action: "PUBLISH",
    actor,
  });

  await writeAudit({
    adminUserId: actor.id,
    action: "faq.publish",
    entityType: "faq_item",
    entityId: id,
    before,
    after: updated,
    ipAddress: actor.ip,
  });

  return updated;
}

export async function updateFaqMeta(
  id: string,
  input: { category?: string; enabled?: boolean; sortOrder?: number },
  actor: Actor,
) {
  const before = await prisma.faqItem.findUnique({ where: { id } });
  if (!before) throw new AppError("NOT_FOUND", "FAQ item not found");

  const updated = await prisma.faqItem.update({ where: { id }, data: input });
  await writeAudit({
    adminUserId: actor.id,
    action: "faq.update",
    entityType: "faq_item",
    entityId: id,
    before,
    after: updated,
    ipAddress: actor.ip,
  });
  return updated;
}

export async function deleteFaqItem(id: string, actor: Actor) {
  const before = await prisma.faqItem.findUnique({ where: { id } });
  if (!before) throw new AppError("NOT_FOUND", "FAQ item not found");

  return prisma.$transaction(async (tx) => {
    await tx.faqItem.delete({ where: { id } });
    await writeAudit(
      {
        adminUserId: actor.id,
        action: "faq.delete",
        entityType: "faq_item",
        entityId: id,
        before,
        ipAddress: actor.ip,
      },
      tx,
    );
    return { id };
  });
}

export async function restoreFaqRevision(
  id: string,
  revisionId: string,
  actor: Actor,
  mode: "draft" | "publish" = "draft",
) {
  const { getRevision } = await import("@/server/admin/content-revision-service");
  const revision = await getRevision(revisionId);
  if (!revision || revision.entityType !== "FAQ_ITEM" || revision.entityId !== id) {
    throw new AppError("NOT_FOUND", "Revision not found");
  }
  const snap = revision.snapshotJson as { question: string; answer: string; category?: string };
  await recordRevision({
    entityType: "FAQ_ITEM",
    entityId: id,
    snapshotJson: snap,
    action: "RESTORE",
    actor,
    note: `from v${revision.version}`,
  });
  if (mode === "publish") return publishFaqItem(id, snap, actor);
  return saveFaqDraft(id, snap, actor);
}

export const FAQ_CATEGORIES = [
  { id: "general", label: "ทั่วไป" },
  { id: "credits", label: "เครดิต & การใช้งาน" },
  { id: "pro", label: "แพ็กเกจ Pro" },
  { id: "payment", label: "การชำระเงิน" },
  { id: "accuracy", label: "ความแม่นยำ" },
] as const;

export const DEFAULT_FAQ_SEED: FaqInput[] = [
  {
    category: "credits",
    question: "เครดิตใช้ทำอะไรได้บ้าง?",
    answer:
      "เครดิตใช้สำหรับขอคำทำนายและสนทนากับ AI ในแต่ละหมวดดูดวง แต่ละคำถามอาจใช้เครดิตตามที่หมวดนั้นกำหนด",
    sortOrder: 1,
  },
  {
    category: "pro",
    question: "สมัคร Pro ได้อย่างไร?",
    answer:
      "ไปที่หน้าบัญชี ดูรายละเอียดแพ็กเกจ Pro โอนเงินตามขั้นตอน แล้วแจ้งชำระเงินพร้อมหลักฐาน แอดมินจะตรวจสอบและเปิดใช้งานให้",
    sortOrder: 2,
  },
  {
    category: "payment",
    question: "แจ้งชำระเงินแล้ว ต้องรอนานแค่ไหน?",
    answer: "โดยทั่วไปภายใน 1–2 วันทำการ หลังแอดมินตรวจสอบหลักฐานการโอน",
    sortOrder: 3,
  },
  {
    category: "accuracy",
    question: "ดูดวงแม่นแค่ไหน?",
    answer:
      "คำทำนายมีไว้เพื่อความบันเทิงและการไตร่ตรองส่วนบุคคล ไม่ใช่คำแนะนำทางการแพทย์ การเงิน หรือกฎหมาย",
    sortOrder: 4,
  },
];

export async function seedDefaultFaqIfEmpty() {
  const count = await prisma.faqItem.count();
  if (count > 0) return { seeded: 0 };
  await prisma.faqItem.createMany({ data: DEFAULT_FAQ_SEED });
  return { seeded: DEFAULT_FAQ_SEED.length };
}
