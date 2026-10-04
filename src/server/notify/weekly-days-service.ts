import { createHmac, timingSafeEqual } from "node:crypto";
import type { ChartJson } from "@/types/chart";
import { prisma } from "@/server/db";
import { sendEmail } from "@/server/email/mailer";
import { scanDaysForChart } from "@/server/horoscope/day-scan-service";
import { bangkokCivilDate } from "@/lib/reading-intent";
import { thaiDayLabel } from "@/lib/day-scan";

/**
 * Monday email: the week's best days and the one to be careful with, from
 * the same day scan as the calendar — computed, no AI. Only for people who
 * switched it on; one click in the email switches it off.
 */

function siteUrl(): string {
  return (process.env.APP_BASE_URL || process.env.AUTH_URL || "https://horasard.com").replace(/\/$/, "");
}

function sign(userId: string): string | null {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret) return null;
  return createHmac("sha256", `weekly-days-unsubscribe:${secret}`).update(userId).digest("base64url");
}

export function unsubscribeUrl(userId: string): string | null {
  const t = sign(userId);
  return t ? `${siteUrl()}/api/notify/weekly-days/unsubscribe?u=${encodeURIComponent(userId)}&t=${t}` : null;
}

export function isValidUnsubscribe(userId: string, token: string): boolean {
  const want = sign(userId);
  if (!want || !token) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** The seven days from `now`, 09:00 Bangkok. */
function weekFrom(now: Date): Date[] {
  const b = new Date(now.getTime() + 7 * 3_600_000);
  return Array.from({ length: 7 }, (_, i) =>
    bangkokCivilDate(b.getUTCFullYear(), b.getUTCMonth() + 1, b.getUTCDate() + i, "09:00"),
  );
}

export function composeWeeklyDays(natal: ChartJson, now: Date, name: string | null, unsubscribe: string | null) {
  const scan = scanDaysForChart({ natal, days: weekFrom(now), topicHouses: [1, 10, 11] });
  const all = scan?.all ?? [];
  const best = all
    .filter((d) => d.dayRole !== "กาลกิณี" && d.score > 0)
    .sort((a, b) => b.score - a.score || a.date.getTime() - b.date.getTime())
    .slice(0, 3)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  const caution = [...all].sort((a, b) => a.score - b.score)[0];
  if (!best.length) return null;

  const line = (d: (typeof all)[number]) =>
    `วัน${d.weekday}ที่ ${thaiDayLabel(d.date)} — ${d.reasons.slice(0, 2).join(" · ")}`;
  const greeting = name ? `สวัสดีครับคุณ${name}` : "สวัสดีครับ";
  const calendar = `${siteUrl()}/calendar`;
  const textLines = [
    greeting,
    "",
    "วันเด่นของคุณสัปดาห์นี้ (คำนวณจากดวงของคุณ):",
    ...best.map((d) => `• ${line(d)}`),
    ...(caution && caution.score < 0 ? ["", `วันที่ควรระวัง: ${line(caution)}`] : []),
    "",
    `ดูปฏิทินทั้งเดือน หรือถามหมอดูต่อ: ${calendar}`,
    "",
    "คำทำนายมีไว้เพื่อความบันเทิงและเป็นแนวทางเท่านั้น",
    ...(unsubscribe ? [`เลิกรับอีเมลนี้: ${unsubscribe}`] : []),
  ];
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const html = `<div style="font-family:sans-serif;line-height:1.7;color:#222">
<p>${esc(greeting)}</p>
<p><b>วันเด่นของคุณสัปดาห์นี้</b> (คำนวณจากดวงของคุณ)</p>
<ul>${best.map((d) => `<li>${esc(line(d))}</li>`).join("")}</ul>
${caution && caution.score < 0 ? `<p><b>วันที่ควรระวัง:</b> ${esc(line(caution))}</p>` : ""}
<p><a href="${calendar}">ดูปฏิทินดวงทั้งเดือน หรือถามหมอดูต่อ</a></p>
<p style="color:#888;font-size:12px">คำทำนายมีไว้เพื่อความบันเทิงและเป็นแนวทางเท่านั้น${
    unsubscribe ? ` · <a href="${unsubscribe}" style="color:#888">เลิกรับอีเมลนี้</a>` : ""
  }</p></div>`;
  return {
    subject: `วันดีของคุณสัปดาห์นี้: ${best.map((d) => `วัน${d.weekday}`).join(" ")}`,
    text: textLines.join("\n"),
    html,
  };
}

/** Send to everyone opted in who has not had this week's yet. */
export async function runWeeklyDaysEmails(opts: { limit?: number; now?: Date } = {}) {
  const now = opts.now ?? new Date();
  const fiveDaysAgo = new Date(now.getTime() - 5 * 86_400_000);
  const users = await prisma.user.findMany({
    where: {
      weeklyDaysEmail: true,
      status: "ACTIVE",
      AND: [
        { OR: [{ weeklyDaysSentAt: null }, { weeklyDaysSentAt: { lt: fiveDaysAgo } }] },
        // A verified address (password accounts) or a provider-verified one.
        { OR: [{ emailVerifiedAt: { not: null } }, { passwordHash: null }] },
      ],
      natalChart: { status: "READY" },
    },
    select: { id: true, email: true, name: true, natalChart: { select: { chartJson: true } } },
    take: opts.limit ?? 200,
  });
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  for (const u of users) {
    const natal = u.natalChart?.chartJson as ChartJson | null;
    const mail = natal ? composeWeeklyDays(natal, now, u.name, unsubscribeUrl(u.id)) : null;
    if (!mail) {
      skipped += 1;
      continue;
    }
    // Claim the week before sending: two server instances running the job
    // at once must not both mail the same person.
    const claim = await prisma.user.updateMany({
      where: { id: u.id, OR: [{ weeklyDaysSentAt: null }, { weeklyDaysSentAt: { lt: fiveDaysAgo } }] },
      data: { weeklyDaysSentAt: now },
    });
    if (!claim.count) {
      skipped += 1;
      continue;
    }
    const result = await sendEmail({ to: u.email, ...mail });
    if (result.ok) {
      sent += 1;
    } else {
      failed += 1;
      // Give the week back so the next run tries again.
      await prisma.user.update({ where: { id: u.id }, data: { weeklyDaysSentAt: null } });
      console.error(`[weekly-days] send failed for ${u.id}: ${result.error}`);
    }
  }
  return { candidates: users.length, sent, skipped, failed };
}
