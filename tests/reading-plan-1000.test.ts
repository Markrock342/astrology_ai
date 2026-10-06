import { describe, expect, it } from "vitest";
import { planReading, type ReadingPlan } from "@/lib/reading-plan";

/**
 * A thousand questions, routed without the model: does each get read from
 * the right thing (day walk, one day, transit, birth chart, future or past
 * timeline) and about the right subject? The owner's chat on 6 Oct 2026
 * (a past break-up dated in the future) was a routing failure.
 */
const NOW = new Date("2026-10-07T03:00:00Z");
type Msg = { role: "USER" | "ASSISTANT"; content: string };
type Expect = (p: ReadingPlan) => string | null;
type Case = { cat: string; q: string; prior?: Msg[]; expect: Expect[] };

const basisIn = (...b: ReadingPlan["basis"][]): Expect => (p) => (b.includes(p.basis) ? null : `basis ${p.basis} ∉ ${b.join("/")}`);
const past = (want: boolean): Expect => (p) => (p.pastEvent === want ? null : `pastEvent ${p.pastEvent}`);
const love: Expect = (p) => (p.relationship ? null : "ไม่ได้จับว่าเป็นเรื่องความรัก");
const pinpoint: Expect = (p) => (p.pinpoint ? null : "ไม่ได้ตอบแบบตรงคำถาม");

let seed = 7;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)]!;

const TOPICS = ["งาน", "การเงิน", "ความรัก", "สุขภาพ", "การเดินทาง", "ครอบครัว", "การเรียน", "ธุรกิจ", "โชคลาภ", "บ้านและที่ดิน"];
const PERIODS = ["เดือนนี้", "เดือนหน้า", "สัปดาห์หน้า", "อาทิตย์นี้", "ช่วง 3 เดือนนี้", "ปีนี้", "ปีหน้า"];
const SHORT = ["เดือนนี้", "เดือนหน้า", "สัปดาห์หน้า", "อาทิตย์นี้"];
const ACTIONS = ["เซ็นสัญญา", "สัมภาษณ์งาน", "ย้ายบ้าน", "เปิดร้าน", "คุยงานกับลูกค้า", "ขอแฟนแต่งงาน", "ออกรถใหม่", "เริ่มงานใหม่", "เดินทางไกล", "สารภาพรัก"];
const cases: Case[] = [];

for (let i = 0; i < 120; i++) {
  const p = pick(SHORT);
  const q = pick([`${p}วันไหนดีที่สุดสำหรับ${pick(ACTIONS)}`, `วันไหน${p}ดวงดีสุด`, `ขอวันดี${p}ไป${pick(ACTIONS)}หน่อย`, `${p}มีวันไหนเหมาะ${pick(ACTIONS)}บ้าง`, `หาฤกษ์${pick(ACTIONS)}${p}ให้หน่อย`]);
  cases.push({ cat: "หาวันดี", q, expect: [basisIn("day-scan"), pinpoint, past(false)] });
}
for (let i = 0; i < 100; i++) {
  const t = pick(TOPICS);
  const p = pick(PERIODS);
  const q = pick([`${p}จะได้เงินก้อนไหม`, `${p}เรื่อง${t}มีเกณฑ์ดีไหมครับ`, `${p}${t}จะดีขึ้นใช่ไหม`, `มีโอกาส${t}ดีขึ้น${p}หรือเปล่า`]);
  cases.push({ cat: "ถามใช่ไหม", q, expect: [pinpoint, basisIn("transit", "day-scan"), past(false)] });
}
for (let i = 0; i < 80; i++) {
  const d = 8 + Math.floor(rnd() * 20);
  cases.push({ cat: "ระบุวันที่", q: `วันที่ ${d} ต.ค. 2569 ${pick(["ดวงผมเป็นยังไง", "ไปสัมภาษณ์งานดีไหม", "เหมาะเซ็นสัญญาไหม"])}`, expect: [basisIn("day-check"), pinpoint] });
}
for (let i = 0; i < 40; i++) {
  const d = 10 + Math.floor(rnd() * 18);
  cases.push({
    cat: "ระบุวันที่ต่อเนื่อง",
    q: `${d} ผมมีนัดคุยงานด้วยนะ`,
    prior: [{ role: "USER", content: "เดือนนี้วันไหนดีสุดเรื่องงาน" }, { role: "ASSISTANT", content: "วันที่ดีที่สุดคือวันศุกร์ที่ 9 ต.ค. 2569" }],
    expect: [basisIn("day-check"), (p) => (p.mentionedDay?.endsWith(`-${String(d).padStart(2, "0")}`) ? null : `วันที่ ${p.mentionedDay}`)],
  });
}
const PAST = ["เราเลิกกันช่วงไหน ตอนอายุเท่าไหร่", "ผมเคยตกงานช่วงไหน", "ที่ผ่านมาผมย้ายบ้านตอนไหน", "เคยป่วยหนักช่วงไหนของชีวิต", "ทำไมผมถึงเสียเงินก้อนใหญ่ ช่วงไหน", "เราหย่ากันไปแล้ว ช่วงนั้นดวงเป็นยังไง", "ผมเคยได้งานแรกตอนอายุเท่าไหร่", "ที่ผ่านมาครอบครัวมีปัญหาหนักช่วงไหน", "แล้วทำไมเราถึงเลิกกัน คุณรู้ไหมเราสองคนเลิกกันช่วงไหนตอนอายุเท่าไหร่", "กุถามว่าวันไหน ช่วงไหนเดือนไหน ที่เราเคยเลิกกัน"];
for (let i = 0; i < 120; i++) cases.push({ cat: "เหตุการณ์อดีต", q: pick(PAST), expect: [past(true), basisIn("timeline-past")] });
const reunion: Msg[] = [
  { role: "USER", content: "ผมกับแฟนจะกลับมาเจอกันอีกไหม ช่วงไหนของชีวิต" },
  { role: "ASSISTANT", content: "ช่วงที่ดีที่สุดคืออายุ 34 ปี (พ.ศ. 2579)" },
];
for (let i = 0; i < 30; i++) {
  cases.push({ cat: "อดีตแก้คำตอบ", q: "แล้วเราเลิกกันช่วงไหน ตอนอายุเท่าไหร่", prior: reunion, expect: [past(true), basisIn("timeline-past"), love] });
  cases.push({
    cat: "อดีตแก้คำตอบ",
    q: pick(["เลิกกันไปแล้วนะ ผิดแล้ว เอาใหม่", "พวกกูเลิกกันไปแล้วฟังนะ เอาใหม่", "ตอนนี้ผมอายุ 24 แล้วเลิกกันแล้ว ตอบใหม่"]),
    prior: [...reunion, { role: "USER", content: "แล้วเราเลิกกันช่วงไหน ตอนอายุเท่าไหร่" }, { role: "ASSISTANT", content: "เดือนกันยายน พ.ศ. 2579 เมื่อคุณอายุย่างเข้า 34 ปี" }],
    expect: [past(true), basisIn("timeline-past"), love],
  });
}
const FUTURE = ["ทั้งชีวิตจุดเปลี่ยนที่ดีสุดอยู่ช่วงอายุเท่าไหร่", "ผมจะรวยตอนอายุเท่าไหร่", "จะได้แต่งงานเมื่อไหร่", "ดวงจะขึ้นตอนไหน", "ช่วงไหนของชีวิตที่การงานรุ่งที่สุด", "เมื่อไหร่จะมีบ้านเป็นของตัวเอง", "ผมกับแฟนจะได้มีโอกาสกลับมาเจอกันอีกไหม ช่วงไหนของชีวิต"];
for (let i = 0; i < 80; i++) cases.push({ cat: "จุดเปลี่ยนอนาคต", q: pick(FUTURE), expect: [basisIn("timeline"), past(false)] });
const NATAL = ["นิสัยผมเป็นคนยังไง", "จุดแข็งจุดอ่อนของผมคืออะไร", "อาชีพอะไรเหมาะกับดวงผม", "คู่ครองของผมจะเป็นคนแบบไหน", "ดวงผมเด่นเรื่องอะไรที่สุด", "ลัคนาผมบอกอะไรบ้าง", "ดวงเดิมเรื่องการเงินเป็นยังไง"];
for (let i = 0; i < 100; i++) cases.push({ cat: "ดวงกำเนิด", q: pick(NATAL), expect: [basisIn("natal"), past(false)] });
for (let i = 0; i < 120; i++) {
  const t = pick(TOPICS);
  const p = pick(PERIODS);
  cases.push({ cat: "เรื่องในช่วงเวลา", q: pick([`${t}${p}เป็นยังไงบ้าง`, `ขอดูดวง${t}${p}`, `${p}เรื่อง${t}ต้องระวังอะไร`]), expect: [basisIn("transit", "day-scan"), past(false)] });
}
const LOVE = ["แฟนจะกลับมาไหม", "ผมกับเธอเข้ากันได้ไหม", "เมื่อไหร่จะเจอเนื้อคู่", "ความรักปีนี้เป็นยังไง", "ควรคบคนนี้ต่อไหม", "จะได้แต่งงานกับแฟนคนนี้ไหม", "ตอนนี้โสด จะมีคนเข้ามาไหม", "อกหักมา จะดีขึ้นเมื่อไหร่"];
for (let i = 0; i < 80; i++) cases.push({ cat: "ความรัก", q: pick(LOVE), expect: [love] });
for (let i = 0; i < 40; i++) {
  const p = pick(PERIODS);
  cases.push({ cat: "ถามต่อเนื่อง", q: pick(["แล้วเรื่องเงินล่ะ", "แล้วความรักล่ะ", "ส่วนสุขภาพล่ะ"]), prior: [{ role: "USER", content: `${p}การงานเป็นยังไง` }, { role: "ASSISTANT", content: "การงานช่วงนี้..." }], expect: [basisIn("transit", "day-scan", "day-check"), past(false)] });
}
for (let i = 0; i < 20; i++) {
  cases.push({ cat: "ถามย้อนแชท", q: pick(["ตอนแรกผมถามถึงวันไหน แล้วคุณตอบว่ายังไง", "ที่ผมถามตอนแรกคือเรื่องอะไรนะ"]), prior: [{ role: "USER", content: "วันที่ 20 ต.ค. 2569 ไปสัมภาษณ์งานดีไหม" }, { role: "ASSISTANT", content: "วันที่ 20 ต.ค. ไม่เหมาะ" }], expect: [(p) => (p.dayPick ? "ไล่หาวันดีใหม่ ทั้งที่ถามย้อนแชท" : null)] });
}
const MESSY = ["งาน?", "ดวงผมเดือนนี้", "เงินจะมาไหมมมม", "แฟนผมแม่งงี่เง่า จะเลิกดีไหม", "Will I get a new job next month?", "ดวงงงง ปีหน้า รุ่งป่าวว", "กุจะได้เลื่อนตำแหน่งปะ", "แม่ป่วย จะหายไหม", ""];
for (let i = 0; i < 50; i++) cases.push({ cat: "พิมพ์มั่ว", q: pick(MESSY), expect: [] });

describe(`routing ${cases.length} questions`, () => {
  const byCat = new Map<string, Case[]>();
  for (const c of cases) byCat.set(c.cat, [...(byCat.get(c.cat) ?? []), c]);
  for (const [cat, list] of byCat) {
    it(`${cat} (${list.length})`, () => {
      const fails: string[] = [];
      for (const c of list) {
        let plan: ReadingPlan;
        try {
          plan = planReading({ question: c.q, priorMessages: c.prior, now: NOW });
        } catch (err) {
          fails.push(`"${c.q}" → throws ${(err as Error).message}`);
          continue;
        }
        const why = c.expect.map((e) => e(plan)).filter(Boolean);
        if (why.length) fails.push(`"${c.q}" → ${why.join("; ")}`);
      }
      expect([...new Set(fails)]).toEqual([]);
    });
  }
  it("is about a thousand", () => expect(cases.length).toBeGreaterThanOrEqual(1000));
});
