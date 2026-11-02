import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";

export const DELIVERY_STATUSES = ["PENDING", "SENT", "DELAYED", "FAILED", "DELIVERED", "BOUNCED", "COMPLAINED", "DEV"] as const;
export const emailHistoryQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  status: z.enum(DELIVERY_STATUSES).optional(),
  category: z.enum(["WEEKLY_DAYS", "SYSTEM"]).optional(),
  search: z.string().trim().max(120).optional(),
});
const eventStatuses: Record<string, string> = {
  "email.sent": "SENT", "email.delivered": "DELIVERED", "email.delivery_delayed": "DELAYED",
  "email.bounced": "BOUNCED", "email.complained": "COMPLAINED", "email.failed": "FAILED", "email.suppressed": "FAILED",
};
const ranks = ["PENDING", "SENT", "DELAYED", "FAILED", "DELIVERED", "BOUNCED", "COMPLAINED"];
export function resolveDeliveryStatus(events: Array<{status: string; occurredAt: Date}>) {
  return [...events].sort((a,b) => ranks.indexOf(b.status) - ranks.indexOf(a.status) || b.occurredAt.getTime() - a.occurredAt.getTime())[0];
}
async function lock(tx: Prisma.TransactionClient, providerId: string) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`email:${providerId}`}))::text`;
}
async function reconcile(tx: Prisma.TransactionClient, providerId: string) {
  const events = await tx.emailDeliveryEvent.findMany({where:{providerId},select:{status:true,occurredAt:true}});
  const latest = resolveDeliveryStatus(events);
  if (latest) await tx.emailDelivery.updateMany({where:{providerId},data:{status:latest.status,statusAt:latest.occurredAt}});
}
export async function attachEmailProvider(id: string, providerId: string) {
  await prisma.$transaction(async tx => {
    await lock(tx,providerId);
    await tx.emailDelivery.update({where:{id},data:{providerId,status:"SENT",statusAt:new Date()}});
    await reconcile(tx,providerId);
  });
}
const payloadSchema = z.object({type:z.string(),created_at:z.iso.datetime({offset:true}),data:z.object({email_id:z.string().min(1).max(200)})});
export async function recordDeliveryEvent(payload: unknown, eventId: string) {
  const type = (payload as {type?: unknown})?.type;
  if (typeof type !== "string" || !eventStatuses[type]) return {tracked:false};
  const event = payloadSchema.parse(payload);
  await prisma.$transaction(async tx => {
    await lock(tx,event.data.email_id);
    await tx.emailDeliveryEvent.upsert({where:{id:eventId},create:{id:eventId,providerId:event.data.email_id,status:eventStatuses[event.type],occurredAt:new Date(event.created_at)},update:{}});
    await reconcile(tx,event.data.email_id);
  });
  return {tracked:true};
}
export async function listEmailHistory(query: z.infer<typeof emailHistoryQuery>) {
  const where: Prisma.EmailDeliveryWhereInput = {
    ...(query.status ? {status:query.status}:{}), ...(query.category ? {category:query.category}:{}),
    ...(query.search ? {OR:[{recipient:{contains:query.search,mode:"insensitive"}},{subject:{contains:query.search,mode:"insensitive"}},{providerId:{contains:query.search,mode:"insensitive"}}]}:{}),
  };
  const total = await prisma.emailDelivery.count({where});
  const page = Math.min(query.page,Math.max(1,Math.ceil(total/25)));
  const items = await prisma.emailDelivery.findMany({where,orderBy:[{createdAt:"desc"},{id:"desc"}],skip:(page-1)*25,take:25});
  return {total,page,pageSize:25,items,webhookConfigured:!!process.env.RESEND_WEBHOOK_SECRET?.trim()};
}
