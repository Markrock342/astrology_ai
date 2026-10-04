/**
 * Answer test suite — real model, real pipeline, throwaway account.
 *
 *   npm run eval:answers            (all scenarios)
 *   npm run eval:answers -- day     (scenarios whose id contains "day")
 *
 * The owner kept finding answers that missed the question ("วันไหนดีสุด"
 * answered with an essay, "14 ผมมีนัด" answered with the birth chart) or got a
 * house lord wrong. Each scenario is a short chat run through sendMessage
 * against the dev database and the configured Gemini key, then checked by
 * rules — so a prompt change is tried on these before the owner tries it.
 * Uses a @horasard.test account with an invented birth date, deleted after.
 */
import { prisma } from "@/server/db";
import { upsertBirthProfile } from "@/server/user/birth-profile-service";
import { grantIncludedUsage } from "@/server/usage/usage-budget-service";
import { createConversation, sendMessage } from "@/server/horoscope/message-service";

type Answer = { text: string; issues: string[] };
type Check = (a: Answer, ctx: { now: Date }) => string | null;
type Scenario = { id: string; turns: Array<{ q: string; checks: Check[] }> };

const THAI_MONTH = "(?:ม\\.ค\\.|ก\\.พ\\.|มี\\.ค\\.|เม\\.ย\\.|พ\\.ค\\.|มิ\\.ย\\.|ก\\.ค\\.|ส\\.ค\\.|ก\\.ย\\.|ต\\.ค\\.|พ\\.ย\\.|ธ\\.ค\\.|มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม)";
const firstLine = (t: string) => t.trim().split("\n").find((l) => l.trim())?.trim() ?? "";

const datesFirst: Check = (a) =>
  new RegExp(`\\d{1,2}\\s*${THAI_MONTH}`).test(firstLine(a.text)) ? null : `ประโยคแรกไม่มีวันที่: "${firstLine(a.text).slice(0, 80)}"`;
const short = (maxChars: number): Check => (a) =>
  a.text.length <= maxChars ? null : `ยาว ${a.text.length} ตัวอักษร (เกิน ${maxChars})`;
const noSections: Check = (a) => (/^#{1,3}\s|\n\|.*\|/m.test(a.text) ? "มีหัวข้อหรือตาราง ทั้งที่ควรตอบสั้น" : null);
const mentions = (re: RegExp, label: string): Check => (a) => (re.test(a.text) ? null : `ไม่พูดถึง ${label}`);
const notMentions = (re: RegExp, label: string): Check => (a) => (re.test(a.text) ? `ไม่ควรมี ${label}` : null);
// A verdict early in the first sentence — "มีครับ", "ยังไม่เด่น", "ปีนี้โอกาสค่อนข้างจำกัด".
const answersYesNo: Check = (a) =>
  /มี|ไม่|ได้|ยัง|จำกัด|เด่น|ดี|น้อย|สูง|ชัด/.test(firstLine(a.text).slice(0, 60))
    ? null
    : `ไม่ตอบ มี/ไม่มี ในประโยคแรก: "${firstLine(a.text).slice(0, 80)}"`;
const lordsRight: Check = (a) => (a.issues.length ? `เจ้าเรือนผิด: ${a.issues.join(", ")}` : null);
const inThisMonth: Check = (a, { now }) => {
  const bkk = new Date(now.getTime() + 7 * 3_600_000);
  const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  return firstLine(a.text).includes(months[bkk.getUTCMonth()]!) ? null : "วันที่แนะนำไม่ได้อยู่ในเดือนนี้";
};

const SCENARIOS: Scenario[] = [
  { id: "day-best-this-month", turns: [{ q: "วันไหนในเดือนนี้ผมจะดวงดีสุด", checks: [datesFirst, inThisMonth, short(900), noSections, lordsRight] }] },
  { id: "day-hire-next-month", turns: [{ q: "เดือนหน้ามีเกณฑ์ได้งานใหม่ไหมครับ", checks: [answersYesNo, short(900), noSections, lordsRight] }] },
  {
    id: "day-followup-named-day",
    turns: [
      { q: "วันไหนที่จะมีคนมาจ้างงานผม", checks: [datesFirst, short(900)] },
      { q: "14 ผมมีนัดคุยงานกับลูกค้าด้วยอะดิ", checks: [mentions(new RegExp(`14\\s*${THAI_MONTH}`), "วันที่ 14"), short(1000), noSections, lordsRight] },
      { q: "แล้วเรื่องเงินล่ะ", checks: [short(1200), noSections, notMentions(/พื้นดวงเดิม[\s\S]*ไล่ดาวเจ้าเรือน/, "การเล่าพื้นดวงยาว")] },
    ],
  },
  {
    // The calendar's "ถามหมอดูเรื่องวันนี้" writes the date out in full.
    id: "day-calendar-ask",
    turns: [{ q: "วันจันทร์ที่ 12 ต.ค. 2569 ดวงผมเป็นยังไง", checks: [mentions(/12\s*(?:ต\.ค\.|ตุลาคม)/, "12 ต.ค."), short(1000), noSections, lordsRight] }],
  },
  { id: "yesno-promotion", turns: [{ q: "ปีนี้ผมจะได้เลื่อนตำแหน่งไหม", checks: [answersYesNo, short(900), noSections, lordsRight] }] },
  { id: "open-career-year", turns: [{ q: "การงานปีนี้เป็นยังไงบ้าง", checks: [lordsRight, notMentions(/ศรีจร.*ของคุณ|วันกาลกิณีจร/, "คำว่า จร ต่อทักษากำเนิด")] }] },
  { id: "natal-personality", turns: [{ q: "นิสัยผมเป็นคนยังไง จุดแข็งคืออะไร", checks: [lordsRight] }] },
  { id: "timeline-life", turns: [{ q: "ทั้งชีวิตจุดเปลี่ยนที่ดีสุดของผมอยู่ช่วงอายุเท่าไหร่", checks: [mentions(/อายุ\s*\d{2}/, "อายุ"), (a) => (/อายุ\s*\d{2}/.test(firstLine(a.text)) ? null : "ประโยคแรกไม่บอกอายุ"), noSections, lordsRight] }] },
];

async function main() {
  const filter = process.argv[2] ?? "";
  const scenarios = SCENARIOS.filter((s) => s.id.includes(filter));
  const now = new Date();
  const email = `eval-${Date.now()}@horasard.test`;
  const user = await prisma.user.create({ data: { email, name: "Eval", emailVerifiedAt: new Date() } });
  const failures: string[] = [];
  try {
    await upsertBirthProfile(user.id, {
      year: 1992, month: 9, day: 23, hour: 7, minute: 45, birthTimeKnown: true,
      birthCountry: "ไทย", birthProvince: "กรุงเทพมหานคร", birthDistrict: "บางรัก",
    } as never);
    const pro = await prisma.package.findUniqueOrThrow({ where: { code: "PRO" } });
    await prisma.userSubscription.create({ data: { userId: user.id, packageId: pro.id, status: "ACTIVE", activationSource: "ADMIN_MANUAL" } });
    await grantIncludedUsage(user.id, 500_000, { type: "INITIAL_GRANT", referenceType: "user", referenceId: `eval:${user.id}`, note: "eval" }, { startsAt: now, endsAt: null });

    for (const sc of scenarios) {
      const conv = (await createConversation({ userId: user.id, mode: "TRANSIT" } as never)) as { id: string };
      for (const [i, turn] of sc.turns.entries()) {
        const t0 = Date.now();
        let answer: Answer = { text: "", issues: [] };
        try {
          const r = (await sendMessage({
            conversationId: conv.id, userId: user.id, content: turn.q,
            idempotencyKey: `eval-${sc.id}-${i}-${Date.now()}`, answerMode: "detailed",
          })) as { id?: string; responseText?: string };
          const row = r.id ? await prisma.horoscopeReading.findUnique({ where: { id: r.id }, select: { promptTraceJson: true } }) : null;
          const issues = ((row?.promptTraceJson as { factIssues?: Array<{ claimed: string; houseName: string; actual: string }> } | null)?.factIssues ?? [])
            .map((x) => `${x.claimed}≠เจ้าเรือน${x.houseName}(${x.actual}) «${(x as { excerpt?: string }).excerpt ?? ""}»`);
          answer = { text: r.responseText ?? "", issues };
        } catch (err) {
          failures.push(`${sc.id}#${i + 1} error: ${(err as Error).message}`);
          console.log(`✗ ${sc.id}#${i + 1} "${turn.q}" — ${(err as Error).message}`);
          continue;
        }
        const problems = turn.checks.map((c) => c(answer, { now })).filter((x): x is string => Boolean(x));
        const secs = ((Date.now() - t0) / 1000).toFixed(1);
        console.log(`${problems.length ? "✗" : "✓"} ${sc.id}#${i + 1} (${secs}s, ${answer.text.length} ตัวอักษร) "${turn.q}"`);
        console.log(`    ↳ ${firstLine(answer.text).slice(0, 110)}`);
        if (problems.length && process.env.EVAL_VERBOSE) console.log(answer.text.replace(/^/gm, "      | "));
        for (const p of problems) {
          console.log(`    ! ${p}`);
          failures.push(`${sc.id}#${i + 1}: ${p}`);
        }
      }
    }
  } finally {
    await prisma.aIUsageLog.deleteMany({ where: { userId: user.id } });
    await prisma.horoscopeReading.deleteMany({ where: { userId: user.id } });
    await prisma.usageTransaction.deleteMany({ where: { userId: user.id } }).catch(() => {});
    await prisma.conversation.deleteMany({ where: { userId: user.id } });
    await prisma.userSubscription.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } }).catch((e) => console.log("ลบบัญชีทดสอบไม่สำเร็จ:", e.message));
  }
  console.log(`\n${failures.length ? `✗ ไม่ผ่าน ${failures.length} ข้อ` : "✓ ผ่านทุกข้อ"}`);
  process.exitCode = failures.length ? 1 : 0;
}

main().finally(() => prisma.$disconnect());
