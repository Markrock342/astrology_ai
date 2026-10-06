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

type Answer = { text: string; issues: string[]; basis?: string };
type Check = (a: Answer, ctx: { now: Date }) => string | null;
type Turn = {
  q: string;
  checks: Check[];
  /** Start a new chat for this turn (memory across chats). */
  newChat?: boolean;
  /** Let the background memory jobs finish first. */
  pauseMs?: number;
};
type Scenario = { id: string; turns: Turn[] };

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
/** Owner case 6 Oct 2026: a 24-year-old's past break-up was dated "at 34, 2579". */
const EVAL_AGE = 24;
const EVAL_BE_NOW = new Date().getUTCFullYear() + 543;
const pastOnly: Check = (a) => {
  const ages = [...a.text.matchAll(/อายุ(?:ย่างเข้า)?\s*(\d{1,2})/g)].map((m) => Number(m[1]));
  const years = [...a.text.matchAll(/(?:พ\.ศ\.\s*|ปี\s*)(25\d\d)/g)].map((m) => Number(m[1]));
  const bad = [...ages.filter((x) => x > EVAL_AGE).map((x) => `อายุ ${x}`), ...years.filter((y) => y > EVAL_BE_NOW).map((y) => `พ.ศ. ${y}`)];
  return bad.length ? `เหตุการณ์ในอดีตแต่ตอบอนาคต: ${bad.join(", ")}` : null;
};
const noScoreLeak: Check = (a) => (/น้ำหนัก\s*\d|คะแนน\s*\d/.test(a.text) ? "ตัวเลขคะแนนภายในหลุดออกมา" : null);
const aboutLove: Check = (a) =>
  /ความรัก|คู่ครอง|ปัตนิ|ความสัมพันธ์|คนรัก|แฟน|คู่/.test(a.text) ? null : "ถามเรื่องความรักแต่ไม่ตอบเรื่องความรัก";
const notCareerLed: Check = (a) => {
  const career = (a.text.match(/กัมมะ|การงาน|อาชีพ/g) ?? []).length;
  const love = (a.text.match(/ปัตนิ|ความรัก|คู่ครอง|ความสัมพันธ์|คนรัก|แฟน/g) ?? []).length;
  return career > love ? `พูดเรื่องงาน (${career}) มากกว่าความรัก (${love})` : null;
};
const basisIs = (re: RegExp, label: string): Check => (a) =>
  a.basis && re.test(a.basis) ? null : `ป้าย "อ่านจาก" ควรเป็น${label} แต่ได้ "${a.basis ?? "—"}"`;
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
  {
    // Saved memories: told in one chat, used in another.
    id: "memory-across-chats",
    turns: [
      { q: "ผมทำงานฟรีแลนซ์ออกแบบกราฟิกอยู่ เดือนหน้างานจะเข้าเยอะไหม", checks: [] },
      {
        q: "ปีหน้าผมควรเปลี่ยนไปทำงานประจำดีไหม",
        newChat: true,
        pauseMs: 15_000,
        checks: [mentions(/ฟรีแลนซ์|กราฟิก|ออกแบบ/, "งานฟรีแลนซ์ที่เคยเล่า")],
      },
    ],
  },
  {
    // The running summary: the first question is long out of the history window.
    id: "memory-long-thread",
    turns: [
      { q: "วันที่ 20 ต.ค. 2569 ไปสัมภาษณ์งานดีไหม", checks: [] },
      ...[
        "แล้วเรื่องเงินช่วงนี้ล่ะ", "ความรักเป็นยังไงบ้าง", "สุขภาพต้องระวังอะไร", "ครอบครัวช่วงนี้", "เพื่อนร่วมงานล่ะ",
        "ควรลงทุนไหม", "เดินทางไกลได้ไหม", "ซื้อรถช่วงนี้ดีไหม", "เรียนต่อดีไหม", "ย้ายบ้านดีไหม", "เริ่มออกกำลังกายวันไหนดี",
        "สีมงคลของผมคือสีอะไร",
      ].map((q) => ({ q, checks: [] as Check[] })),
      {
        q: "ตอนแรกสุดที่ผมถามในแชทนี้ ผมถามถึงวันไหน แล้วหมอดูตอบว่ายังไง",
        pauseMs: 20_000,
        checks: [mentions(/20\s*(?:ต\.ค\.|ตุลาคม)/, "วันที่ 20 ต.ค. ที่ถามตอนแรก")],
      },
    ],
  },
  {
    // The owner's 6 Oct chat: future reunion, then a past break-up, then corrections.
    id: "relationship-past-breakup",
    turns: [
      { q: "ผมกับแฟนจะได้มีโอกาสกลับมาเจอกันอีกไหม ช่วงไหนของชีวิต", checks: [aboutLove, notCareerLed, noScoreLeak, basisIs(/ไทม์ไลน์ชีวิต/, "ไทม์ไลน์ชีวิต")] },
      { q: "แล้วทำไมเราถึงเลิกกัน คุณรู้ไหมเราสองคนเลิกกันช่วงไหนตอนอายุเท่าไหร่", checks: [pastOnly, noScoreLeak, aboutLove, basisIs(/ย้อนหลัง/, "ไทม์ไลน์ย้อนหลัง")] },
      { q: "พวกเราเลิกกันไปแล้วนะ เอาใหม่", checks: [pastOnly, noScoreLeak] },
      { q: "ตอนนี้ผมอายุ 24 แล้วเลิกกันแล้ว ตอบใหม่", checks: [pastOnly, noScoreLeak] },
    ],
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
      // Age 24 in Oct 2026, like the owner's user — the past-event checks rely on it.
      year: 2002, month: 3, day: 10, hour: 8, minute: 30, birthTimeKnown: true,
      birthCountry: "ไทย", birthProvince: "กรุงเทพมหานคร", birthDistrict: "บางรัก",
    } as never);
    const pro = await prisma.package.findUniqueOrThrow({ where: { code: "PRO" } });
    await prisma.userSubscription.create({ data: { userId: user.id, packageId: pro.id, status: "ACTIVE", activationSource: "ADMIN_MANUAL" } });
    await grantIncludedUsage(user.id, 500_000, { type: "INITIAL_GRANT", referenceType: "user", referenceId: `eval:${user.id}`, note: "eval" }, { startsAt: now, endsAt: null });

    for (const sc of scenarios) {
      let conv = (await createConversation({ userId: user.id, mode: "TRANSIT" } as never)) as { id: string };
      for (const [i, turn] of sc.turns.entries()) {
        if (turn.pauseMs) await new Promise((r) => setTimeout(r, turn.pauseMs));
        if (turn.newChat) conv = (await createConversation({ userId: user.id, mode: "TRANSIT" } as never)) as { id: string };
        const t0 = Date.now();
        let answer: Answer = { text: "", issues: [] };
        try {
          const r = (await sendMessage({
            conversationId: conv.id, userId: user.id, content: turn.q,
            idempotencyKey: `eval-${sc.id}-${i}-${Date.now()}`, answerMode: "detailed",
          })) as { id?: string; responseText?: string; basis?: string };
          const row = r.id ? await prisma.horoscopeReading.findUnique({ where: { id: r.id }, select: { promptTraceJson: true } }) : null;
          const issues = ((row?.promptTraceJson as { factIssues?: Array<{ claimed: string; houseName: string; actual: string }> } | null)?.factIssues ?? [])
            .map((x) => `${x.claimed}≠เจ้าเรือน${x.houseName}(${x.actual}) «${(x as { excerpt?: string }).excerpt ?? ""}»`);
          answer = { text: r.responseText ?? "", issues, basis: r.basis };
        } catch (err) {
          failures.push(`${sc.id}#${i + 1} error: ${(err as Error).message}`);
          console.log(`✗ ${sc.id}#${i + 1} "${turn.q}" — ${(err as Error).message}`);
          continue;
        }
        const problems = turn.checks.map((c) => c(answer, { now })).filter((x): x is string => Boolean(x));
        if (!turn.checks.length) {
          process.stdout.write(".");
          continue;
        }
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
    if (process.env.EVAL_VERBOSE) {
      const convs = await prisma.conversation.findMany({ where: { userId: user.id }, select: { summary: true, summaryCovers: true } });
      for (const c of convs) if (c.summary) console.log(`  [summary covers ${c.summaryCovers}]\n${c.summary.replace(/^/gm, "    ")}`);
      const facts = await prisma.userMemoryFact.findMany({ where: { userId: user.id }, select: { text: true } });
      if (facts.length) console.log(`  [facts] ${facts.map((f) => f.text).join(" | ")}`);
    }
  } finally {
    // Background memory jobs from the last turn may still be writing.
    await new Promise((r) => setTimeout(r, 8_000));
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
