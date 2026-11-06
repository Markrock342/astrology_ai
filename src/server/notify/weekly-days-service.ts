import { createHmac, timingSafeEqual } from "node:crypto";
import type { ChartJson } from "@/types/chart";
import { prisma } from "@/server/db";
import { sendEmail } from "@/server/email/mailer";
import { scanDaysForChart } from "@/server/horoscope/day-scan-service";
import { thaiDayLabel } from "@/lib/day-scan";
import { generateOnce } from "@/server/ai/router";
import { resolveAuxConfig } from "@/server/horoscope/follow-up-suggestions";
import { logUsage } from "@/server/ai/usage-logger";
import { emailGreeting, emailSupport, emailSignature, renderEmail } from "@/server/email/templates";

/** Weekly overview of the Bangkok Sunday–Saturday week; delivery remains Monday morning. */

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

/** The containing Sunday–Saturday week at 09:00 Bangkok, including month/year edges. */
export function weeklyDates(now: Date): Date[] {
  const b = new Date(now.getTime() + 7 * 3_600_000);
  return Array.from({ length: 7 }, (_, i) =>
    new Date(Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate() - b.getUTCDay() + i, 2)),
  );
}

export function weeklyFacts(natal: ChartJson, now: Date) {
  return scanDaysForChart({ natal, days: weeklyDates(now), topicHouses: [1, 2, 5, 6, 7, 10, 11] })?.all ?? [];
}

type WeeklyFacts = ReturnType<typeof weeklyFacts>;
const dayLine = (d: WeeklyFacts[number]) => `วัน${d.weekday}ที่ ${thaiDayLabel(d.date)} — ${d.reasons.slice(0, 2).join(" · ") || "วางแผนและดำเนินกิจวัตรอย่างรอบคอบ"}`;

export function weeklySummaryPrompt(facts: WeeklyFacts) {
  return {
    systemPrompt: `คุณคืออาจารย์ดูดวง HORASARD ไม่ระบุเพศ เขียนสรุปดวงรายสัปดาห์เป็นภาษาไทยที่อ่านง่าย 1–2 ย่อหน้า รวม 300–900 ตัวอักษร
ใช้เฉพาะข้อเท็จจริงครบทั้ง 7 วันในข้อมูล JSON ช่วงวันอาทิตย์ถึงวันเสาร์ สรุปแนวโน้มโดยรวม โอกาส และสิ่งที่ควรระวัง ไม่ใช่เลือกเฉพาะ 3 วัน
ห้ามแต่งตำแหน่งดาว เหตุการณ์ ชื่อ บุคลิก เพศ วันที่ หรือรับประกันผล ห้ามทำนายสุขภาพหรือการลงทุนแบบฟันธง ไม่เรียกตนเองว่าแม่หมอ
คะแนนเป็นเพียงการจัดอันดับจากการคำนวณ ไม่ใช่ความน่าจะเป็น ไม่แสดงศัพท์เทคนิคและตัวเลขคะแนนในคำตอบ
ตอบ JSON เท่านั้น {"overview":"สรุปภาพรวม"} ห้าม HTML, Markdown, URL และข้อความชวนซื้อ`,
    // Only derived facts go to the provider: no names, emails, birth input or conversations.
    userPrompt: JSON.stringify(facts.map(d => ({ weekday: d.weekday, date: thaiDayLabel(d.date), role: d.dayRole, moonSign: d.moonSign, moonHouse: d.moonHouse, reasons: d.reasons, score: d.score }))),
    maxOutputTokens: 1400,
    timeoutMs: 15_000,
  };
}

export function parseWeeklyOverview(raw: string): string | null {
  try {
    const parsed = JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
    const overview = typeof parsed.overview === "string" ? parsed.overview.trim() : "";
    if (overview.length < 40 || overview.length > 1200 || !/[ก-๙]/u.test(overview) || /[<>]|https?:|www\.|@|แม่หมอ/u.test(overview)) return null;
    return overview;
  } catch { return null; }
}

export async function generateWeeklyOverview(facts: WeeklyFacts, userId: string): Promise<string | null> {
  try {
    const config = await resolveAuxConfig();
    if (!config) return null;
    // One bounded attempt per recipient; provider failure must not abort the whole batch.
    const result = await generateOnce(config.id, weeklySummaryPrompt(facts));
    const overview = result.ok && result.rawText ? parseWeeklyOverview(result.rawText) : null;
    await logUsage({ userId, provider: result.provider, modelId: result.modelId,
      status: result.ok ? "SUCCESS" : "FAILED", latencyMs: result.latencyMs,
      inputUsage: result.usage?.inputTokens, outputUsage: result.usage?.outputTokens,
      cachedUsage: result.usage?.cachedTokens, errorCode: "WEEKLY_EMAIL_SUMMARY",
    }).catch(() => {});
    return overview;
  } catch {
    console.warn("[weekly-days] AI summary unavailable; using calculated seven-day summary");
    return null;
  }
}

export function composeWeeklyDays(natal: ChartJson, now: Date, name: string | null, unsubscribe: string | null, overview?: string | null, computedFacts?: WeeklyFacts) {
  const all = computedFacts ?? weeklyFacts(natal, now);
  if (all.length !== 7) return null;
  const from = `วัน${all[0].weekday}ที่ ${thaiDayLabel(all[0].date)}`;
  const to = `วัน${all[6].weekday}ที่ ${thaiDayLabel(all[6].date)}`;
  const best = all.filter(d => d.dayRole !== "กาลกิณี" && d.score > 0)
    .sort((a,b) => b.score-a.score || a.date.getTime()-b.date.getTime()).slice(0,3)
    .sort((a,b) => a.date.getTime()-b.date.getTime());
  const caution = [...all].sort((a,b) => a.score-b.score)[0];
  const calendar = `${siteUrl()}/calendar`;
  const message = renderEmail(`[HORASARD] เช็กดวงรายสัปดาห์ของคุณ (${from} - ${to})`, [
    emailGreeting(name),
    `ดวงรายสัปดาห์ ${from} ถึง ${to}`,
    "ทีมงานขอส่งคำทำนายดวงชะตารายสัปดาห์จากผลคำนวณการโคจรของดวงดาว เพื่อเป็นแนวทางเตรียมพร้อมและวางแผนจังหวะชีวิต ดังนี้",
    overview || `สรุปจากผลคำนวณทั้ง 7 วัน:\n${all.map(dayLine).join("\n")}`,
    ...(best.length ? [`วันเด่นของสัปดาห์: ${best.map(d => `วัน${d.weekday}ที่ ${thaiDayLabel(d.date)}`).join(" · ")}`] : []),
    ...(caution.score < 0 ? [`วันที่ควรระวัง: ${dayLine(caution)}`] : []),
    "หากคุณต้องการพิมพ์คำถามเพื่อเจาะลึกเรื่องราวเฉพาะตัว สามารถเข้าสู่ระบบเพื่อตรวจสอบดวงชะตาแบบเต็มรูปแบบ:",
    { label: "ตรวจสอบดวงชะตาส่วนตัวของคุณ", url: calendar },
    "ขอให้สัปดาห์นี้เป็นสัปดาห์ที่ราบรื่นและเต็มไปด้วยรอยยิ้ม",
    emailSupport, emailSignature,
    "คำทำนายมีไว้เพื่อความบันเทิงและเป็นแนวทางเท่านั้น",
    ...(unsubscribe ? [{ label: "ยกเลิกการรับดวงรายสัปดาห์ (Unsubscribe)", url: unsubscribe }] : []),
  ]);
  return { ...message, headers: unsubscribe ? {
    "List-Unsubscribe": `<${unsubscribe}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  } : undefined };
}

const RETRY_AFTER_FAIL_MS = 60 * 60_000;

/** Send to everyone opted in who has not had this week's yet. */
export async function runWeeklyDaysEmails(opts: { limit?: number; now?: Date } = {}) {
  const now = opts.now ?? new Date();
  const startedAt = Date.now();
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
    // Longest-waiting first, so the batch always moves on.
    orderBy: [{ weeklyDaysSentAt: { sort: "asc", nulls: "first" } }, { id: "asc" }],
    take: Math.min(opts.limit ?? 10, 10),
  });
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  for (const u of users) {
    if (Date.now() - startedAt > 220_000) break;
    // Claim the week before anything else: two server instances running the
    // job at once must not both mail the same person — and someone with no
    // email this week is done for the week too. Unclaimed, they came back in
    // every 15-minute run and, 200 at a time, could hold the batch forever.
    const claim = await prisma.user.updateMany({
      where: { id: u.id, OR: [{ weeklyDaysSentAt: null }, { weeklyDaysSentAt: { lt: fiveDaysAgo } }] },
      data: { weeklyDaysSentAt: now },
    });
    if (!claim.count) {
      skipped += 1;
      continue;
    }
    try {
      const natal = u.natalChart?.chartJson as ChartJson | null;
      const facts = natal ? weeklyFacts(natal, now) : [];
      const unsubscribe = unsubscribeUrl(u.id);
      const overview = facts.length === 7 && unsubscribe ? await generateWeeklyOverview(facts, u.id) : null;
      const mail = natal && unsubscribe ? composeWeeklyDays(natal, now, u.name, unsubscribe, overview, facts) : null;
      if (!mail) {
        skipped += 1;
        continue;
      }
      // Honour an opt-out that arrived while the provider was generating the overview.
      const current = await prisma.user.findUnique({ where: { id: u.id }, select: { weeklyDaysEmail: true, status: true } });
      if (!current?.weeklyDaysEmail || current.status !== "ACTIVE") { skipped += 1; continue; }
      const result = await sendEmail({ to: u.email, category: "WEEKLY_DAYS", ...mail })
        .catch(() => ({ ok: false as const, error: "Email transport error" }));
      if (result.ok) {
        sent += 1;
      } else {
        failed += 1;
        // Try again in about an hour, not on every 15-minute run.
        await prisma.user.update({
          where: { id: u.id },
          data: { weeklyDaysSentAt: new Date(fiveDaysAgo.getTime() + RETRY_AFTER_FAIL_MS) },
        });
        console.error(`[weekly-days] send failed for ${u.id}: ${result.error}`);
      }
    } catch {
      failed += 1;
      await prisma.user.update({where: {id: u.id}, data: {weeklyDaysSentAt: new Date(fiveDaysAgo.getTime() + RETRY_AFTER_FAIL_MS)}});
      console.warn("[weekly-days] recipient processing failed; deferred for retry");
    }
  }
  return { candidates: users.length, sent, skipped, failed };
}
