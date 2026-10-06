/**
 * The 1,000-question suite: every kind of question users ask, on six
 * invented people, through the real pipeline and model, each answer checked
 * by rule and graded by a second model.
 *
 *   npx tsx --env-file=.env scripts/eval-1000.ts [limit] [concurrency] [filter]
 *
 * Writes tmp/eval-1000/results.jsonl and prints a summary by category.
 * Throwaway @horasard.test accounts, deleted at the end.
 */
import fs from "node:fs";
import { prisma } from "@/server/db";
import { upsertBirthProfile } from "@/server/user/birth-profile-service";
import { grantIncludedUsage } from "@/server/usage/usage-budget-service";
import { createConversation, sendMessage } from "@/server/horoscope/message-service";
import { generateWithFallback } from "@/server/ai/router";
import { findGlitchedLines } from "@/server/ai/script-repair";

type Persona = {
  key: string;
  age: number;
  profile: Record<string, unknown>;
};
const NOW = new Date();
const BE_NOW = NOW.getUTCFullYear() + 543;
const P: Persona[] = [
  { key: "p24", age: 24, profile: { year: 2002, month: 3, day: 10, hour: 8, minute: 30, birthTimeKnown: true, birthCountry: "ไทย", birthProvince: "กรุงเทพมหานคร", birthDistrict: "บางรัก" } },
  { key: "p34", age: 34, profile: { year: 1992, month: 9, day: 23, hour: 7, minute: 45, birthTimeKnown: true, birthCountry: "ไทย", birthProvince: "กรุงเทพมหานคร", birthDistrict: "พระนคร" } },
  { key: "p47", age: 47, profile: { year: 1978, month: 12, day: 5, hour: 22, minute: 10, birthTimeKnown: true, birthCountry: "ไทย", birthProvince: "เชียงใหม่", birthDistrict: "เมืองเชียงใหม่" } },
  { key: "p66", age: 66, profile: { year: 1960, month: 6, day: 18, hour: 5, minute: 20, birthTimeKnown: true, birthCountry: "ไทย", birthProvince: "ขอนแก่น", birthDistrict: "เมืองขอนแก่น" } },
  { key: "pNoTime", age: 31, profile: { year: 1995, month: 1, day: 30, hour: 12, minute: 0, birthTimeKnown: false, birthCountry: "ไทย", birthProvince: "สงขลา", birthDistrict: "หาดใหญ่" } },
  { key: "pTokyo", age: 27, profile: { year: 1999, month: 7, day: 7, hour: 14, minute: 0, birthTimeKnown: true, birthCountry: "อื่น ๆ", birthProvince: "Tokyo", birthDistrict: "Tokyo" } },
];

type Answer = { text: string; basis?: string; issues: string[]; error?: string };
type Ctx = { persona: Persona; prev: Answer[]; question: string };
type Check = { name: string; run: (a: Answer, c: Ctx) => string | null };
type Turn = { q: string; checks: Check[] };
type Case = { id: string; category: string; persona: Persona; turns: Turn[] };

// ---------- checks ----------
const firstLine = (t: string) => t.trim().split("\n").find((l) => l.trim())?.trim() ?? "";
const MONTHS = "(?:ม\\.ค\\.|ก\\.พ\\.|มี\\.ค\\.|เม\\.ย\\.|พ\\.ค\\.|มิ\\.ย\\.|ก\\.ค\\.|ส\\.ค\\.|ก\\.ย\\.|ต\\.ค\\.|พ\\.ย\\.|ธ\\.ค\\.|มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม)";
const C = {
  dateFirst: { name: "วันที่ในประโยคแรก", run: (a) => (new RegExp(`\\d{1,2}\\s*${MONTHS}`).test(firstLine(a.text)) ? null : `ประโยคแรก: ${firstLine(a.text).slice(0, 70)}`) } as Check,
  verdictFirst: { name: "ตอบมี/ไม่มีก่อน", run: (a) => (/มี|ไม่|ได้|ยัง|จำกัด|เด่น|ดี|น้อย|สูง|ชัด|ควร|เหมาะ/.test(firstLine(a.text).slice(0, 70)) ? null : `ประโยคแรก: ${firstLine(a.text).slice(0, 70)}`) } as Check,
  short: (n: number): Check => ({ name: `สั้น ≤${n}`, run: (a) => (a.text.length <= n ? null : `ยาว ${a.text.length}`) }),
  noSections: { name: "ไม่มีหัวข้อ/ตาราง", run: (a) => (/^#{1,3}\s|\n\|.*\|/m.test(a.text) ? "มีหัวข้อหรือตาราง" : null) } as Check,
  summary: { name: "มีสรุปท้าย", run: (a) => (/สรุป\s*[:：]/.test(a.text.slice(-500)) ? null : "ไม่มีบรรทัดสรุปท้าย") } as Check,
  pastOnly: {
    name: "อดีตไม่ตอบอนาคต",
    run: (a, c) => {
      const ages = [...a.text.matchAll(/อายุ(?:ย่างเข้า|ย่าง)?\s*(\d{1,2})/g)].map((m) => Number(m[1]));
      const years = [...a.text.matchAll(/(?:พ\.ศ\.\s*|ปี\s*)(25\d\d)/g)].map((m) => Number(m[1]));
      const bad = [...ages.filter((x) => x > c.persona.age).map((x) => `อายุ ${x}`), ...years.filter((y) => y > BE_NOW).map((y) => `พ.ศ. ${y}`)];
      return bad.length ? bad.join(", ") : null;
    },
  } as Check,
  futureOnly: {
    name: "อนาคตไม่ตอบอดีต",
    run: (a, c) => {
      const ages = [...a.text.matchAll(/อายุ\s*(\d{1,2})\s*ปี/g)].map((m) => Number(m[1]));
      const bad = ages.filter((x) => x < c.persona.age);
      return bad.length ? `อายุ ${bad.join(", ")} (อายุตอนนี้ ${c.persona.age})` : null;
    },
  } as Check,
  ageFirst: { name: "บอกอายุในประโยคแรก", run: (a) => (/อายุ\s*\d{2}/.test(firstLine(a.text)) ? null : `ประโยคแรก: ${firstLine(a.text).slice(0, 70)}`) } as Check,
  love: { name: "ตอบเรื่องความรัก", run: (a) => (/ความรัก|คู่ครอง|ปัตนิ|ความสัมพันธ์|คนรัก|แฟน|คู่/.test(a.text) ? null : "ไม่พูดเรื่องความรัก") } as Check,
  notCareerLed: {
    name: "ไม่ลากไปเรื่องงาน",
    run: (a) => {
      const career = (a.text.match(/กัมมะ|การงาน|อาชีพ/g) ?? []).length;
      const love = (a.text.match(/ปัตนิ|ความรัก|คู่ครอง|ความสัมพันธ์|คนรัก|แฟน/g) ?? []).length;
      return career > love + 1 ? `งาน ${career} > รัก ${love}` : null;
    },
  } as Check,
  topic: (re: RegExp, label: string): Check => ({ name: `ตรงหัวข้อ${label}`, run: (a) => (re.test(a.text) ? null : `ไม่พูดถึง${label}`) }),
  basis: (re: RegExp, label: string): Check => ({ name: `ป้าย:${label}`, run: (a) => (a.basis && re.test(a.basis) ? null : `ได้ "${a.basis ?? "—"}"`) }),
  mentions: (re: RegExp, label: string): Check => ({ name: label, run: (a) => (re.test(a.text) ? null : `ไม่มี ${label}`) }),
  noRepeat: {
    name: "ไม่ตอบซ้ำคำตอบก่อน",
    run: (a, c) => {
      const prev = c.prev.at(-1);
      if (!prev?.text) return null;
      const grams = (t: string) => new Set(t.replace(/\s+/g, "").match(/.{6}/g) ?? []);
      const x = grams(a.text);
      const y = grams(prev.text);
      const inter = [...x].filter((g) => y.has(g)).length;
      const sim = inter / Math.max(1, Math.min(x.size, y.size));
      return sim > 0.6 ? `ซ้ำคำตอบก่อน ${(sim * 100).toFixed(0)}%` : null;
    },
  } as Check,
};
const UNIVERSAL: Check[] = [
  { name: "ไม่ว่าง/ไม่ error", run: (a) => (a.error ? `error: ${a.error}` : a.text.trim().length < 20 ? "คำตอบว่าง" : null) },
  { name: "ไม่มีอักษรเพี้ยน", run: (a) => (findGlitchedLines(a.text).length ? "มีอักษรภาษาอื่นปน" : null) },
  { name: "ไม่หลุดคะแนน", run: (a) => (/น้ำหนัก\s*\d|คะแนน\s*\d/.test(a.text) ? "ตัวเลขคะแนนหลุด" : null) },
  { name: "เจ้าเรือนถูก", run: (a) => (a.issues.length ? a.issues.join(", ") : null) },
  { name: "มีป้ายอ่านจาก", run: (a) => (a.text && !a.basis ? "ไม่มีป้ายอ่านจาก" : null) },
];

// ---------- cases ----------
const TOPICS = [
  { w: "งาน", re: /งาน|อาชีพ|กัมมะ/ }, { w: "การเงิน", re: /เงิน|ทรัพย์|รายได้|กดุมภะ/ },
  { w: "ความรัก", re: /รัก|คู่|ปัตนิ|ความสัมพันธ์/ }, { w: "สุขภาพ", re: /สุขภาพ|ร่างกาย|เจ็บ|ป่วย/ },
  { w: "การเดินทาง", re: /เดินทาง|ต่างประเทศ|ศุภะ/ }, { w: "ครอบครัว", re: /ครอบครัว|พ่อแม่|บ้าน|พันธุ/ },
  { w: "การเรียน", re: /เรียน|สอบ|ความรู้/ }, { w: "ธุรกิจ", re: /ธุรกิจ|ค้าขาย|ลงทุน|กิจการ/ },
  { w: "โชคลาภ", re: /โชค|ลาภ/ }, { w: "บ้านและที่ดิน", re: /บ้าน|ที่ดิน|อสังหา|พันธุ/ },
];
const PERIODS = ["เดือนนี้", "เดือนหน้า", "สัปดาห์หน้า", "อาทิตย์นี้", "ช่วง 3 เดือนนี้", "ปีนี้", "ปีหน้า"];
const SHORT_PERIODS = ["เดือนนี้", "เดือนหน้า", "สัปดาห์หน้า", "อาทิตย์นี้"];
let seed = 20261007;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)]!;
const cases: Case[] = [];
const add = (category: string, turns: Turn[], persona = pick(P)) =>
  cases.push({ id: `${category}-${cases.length}`, category, persona, turns });

const DAY_ACTIONS = ["เซ็นสัญญา", "สัมภาษณ์งาน", "ย้ายบ้าน", "เปิดร้าน", "คุยงานกับลูกค้า", "ขอแฟนแต่งงาน", "ออกรถใหม่", "เริ่มงานใหม่", "ไปหาหมอ", "เดินทางไกล", "ยื่นเรื่องกู้เงิน", "สารภาพรัก"];
for (let i = 0; i < 110; i++) {
  const p = pick(SHORT_PERIODS);
  const forms = [`${p}วันไหนดีที่สุดสำหรับ${pick(DAY_ACTIONS)}`, `วันไหน${p}ดวงดีสุด`, `ขอวันดี${p}ไป${pick(DAY_ACTIONS)}หน่อย`, `${p}มีวันไหนเหมาะ${pick(DAY_ACTIONS)}บ้าง`, `หาฤกษ์${pick(DAY_ACTIONS)}${p}ให้หน่อย`];
  add("หาวันดี", [{ q: pick(forms), checks: [C.dateFirst, C.short(1300), C.basis(/ไล่ดวงจรทีละวัน/, "ไล่วัน")] }]);
}
for (let i = 0; i < 100; i++) {
  const t = pick(TOPICS);
  const p = pick(PERIODS);
  const forms = [`${p}จะได้${t.w === "งาน" ? "งานใหม่" : t.w === "ความรัก" ? "เจอคนรัก" : t.w === "การเงิน" ? "เงินก้อน" : "ข่าวดีเรื่อง" + t.w}ไหม`, `${p}เรื่อง${t.w}มีเกณฑ์ดีไหมครับ`, `${p}${t.w}จะดีขึ้นใช่ไหม`, `มีโอกาส${t.w}ดีขึ้น${p}หรือเปล่า`];
  add("ถามใช่ไหม", [{ q: pick(forms), checks: [C.verdictFirst, C.short(1300), C.topic(t.re, t.w)] }]);
}
for (let i = 0; i < 45; i++) {
  const d = 8 + Math.floor(rnd() * 20);
  add("ระบุวันที่", [{ q: `วันที่ ${d} ต.ค. 2569 ${pick(["ดวงผมเป็นยังไง", "ไปสัมภาษณ์งานดีไหม", "เหมาะเซ็นสัญญาไหม", "ดวงความรักเป็นยังไง"])}`, checks: [C.mentions(new RegExp(`${d}\\s*(?:ต\\.ค\\.|ตุลาคม)`), `วันที่ ${d}`), C.short(1400), C.basis(/ดวงจร|ไล่/, "ดวงจร")] }]);
}
for (let i = 0; i < 18; i++) {
  const d = 10 + Math.floor(rnd() * 18);
  add("ระบุวันที่-ต่อเนื่อง", [
    { q: "เดือนนี้วันไหนดีสุดเรื่องงาน", checks: [C.dateFirst] },
    { q: `${d} ผมมีนัดคุยงานด้วยนะ`, checks: [C.mentions(new RegExp(`${d}\\s*(?:ต\\.ค\\.|ตุลาคม)`), `วันที่ ${d}`), C.basis(/ดวงจร/, "ดวงจร"), C.noRepeat] },
  ]);
}
const PAST_EVENTS = [
  ["เลิกกับแฟน", "เราเลิกกันช่วงไหน ตอนอายุเท่าไหร่"], ["ตกงาน", "ผมเคยตกงานช่วงไหน"], ["ย้ายบ้าน", "ที่ผ่านมาผมย้ายบ้านตอนไหน"],
  ["ป่วยหนัก", "เคยป่วยหนักช่วงไหนของชีวิต"], ["เสียเงินก้อน", "ทำไมผมถึงเสียเงินก้อนใหญ่ ช่วงไหน"], ["หย่า", "เราหย่ากันไปแล้ว ช่วงนั้นดวงเป็นยังไง"],
  ["ได้งานแรก", "ผมได้งานแรกตอนอายุเท่าไหร่"], ["มีปัญหาครอบครัว", "ที่ผ่านมาครอบครัวมีปัญหาหนักช่วงไหน"],
];
for (let i = 0; i < 80; i++) {
  const [, q] = pick(PAST_EVENTS);
  add("เหตุการณ์อดีต", [{ q, checks: [C.pastOnly, C.basis(/ย้อนหลัง/, "ย้อนหลัง")] }]);
}
for (let i = 0; i < 15; i++) {
  add("อดีต-แก้คำตอบ", [
    { q: "ผมกับแฟนจะกลับมาเจอกันอีกไหม ช่วงไหนของชีวิต", checks: [C.love, C.notCareerLed] },
    { q: "แล้วเราเลิกกันช่วงไหน ตอนอายุเท่าไหร่", checks: [C.pastOnly, C.love] },
    { q: "เลิกกันไปแล้วนะ ผิดแล้ว เอาใหม่", checks: [C.pastOnly, C.noRepeat] },
  ]);
}
const FUTURE_TL = ["ทั้งชีวิตจุดเปลี่ยนที่ดีสุดอยู่ช่วงอายุเท่าไหร่", "ผมจะรวยตอนอายุเท่าไหร่", "จะได้แต่งงานเมื่อไหร่", "ดวงจะขึ้นตอนไหน", "ช่วงไหนของชีวิตที่การงานรุ่งที่สุด", "เมื่อไหร่จะมีบ้านเป็นของตัวเอง"];
for (let i = 0; i < 80; i++) {
  add("จุดเปลี่ยนอนาคต", [{ q: pick(FUTURE_TL), checks: [C.ageFirst, C.futureOnly, C.basis(/ไทม์ไลน์ชีวิต \(/, "ไทม์ไลน์อนาคต")] }]);
}
const NATAL = ["นิสัยผมเป็นคนยังไง", "จุดแข็งจุดอ่อนของผมคืออะไร", "อาชีพอะไรเหมาะกับดวงผม", "คู่ครองของผมจะเป็นคนแบบไหน", "ดวงผมเด่นเรื่องอะไรที่สุด", "ผมควรระวังเรื่องอะไรในชีวิต", "ลัคนาผมบอกอะไรบ้าง", "ดวงเดิมเรื่องการเงินเป็นยังไง"];
for (let i = 0; i < 90; i++) add("ดวงกำเนิด", [{ q: pick(NATAL), checks: [C.summary, C.basis(/พื้นดวงเดิม/, "พื้นดวงเดิม")] }]);
for (let i = 0; i < 110; i++) {
  const t = pick(TOPICS);
  const p = pick(PERIODS);
  add("เรื่องในช่วงเวลา", [{ q: pick([`${t.w}${p}เป็นยังไงบ้าง`, `ขอดูดวง${t.w}${p}`, `${p}เรื่อง${t.w}ต้องระวังอะไร`]), checks: [C.summary, C.topic(t.re, t.w), C.basis(/ดวงจร|ไล่/, "ดวงจร")] }]);
}
const LOVE = ["แฟนจะกลับมาไหม", "ผมกับเธอเข้ากันได้ไหม", "เมื่อไหร่จะเจอเนื้อคู่", "ความรักปีนี้เป็นยังไง", "ควรคบคนนี้ต่อไหม", "แฟนนอกใจหรือเปล่า", "จะได้แต่งงานกับแฟนคนนี้ไหม", "ตอนนี้โสด จะมีคนเข้ามาไหม"];
for (let i = 0; i < 80; i++) add("ความรัก", [{ q: pick(LOVE), checks: [C.love, C.notCareerLed] }]);
for (let i = 0; i < 20; i++) {
  add("ถามต่อเนื่อง", [
    { q: `${pick(PERIODS)}การงานเป็นยังไง`, checks: [] },
    { q: "แล้วเรื่องเงินล่ะ", checks: [C.topic(/เงิน|ทรัพย์|รายได้/, "เงิน"), C.noRepeat] },
    { q: "แล้วความรักล่ะ", checks: [C.love, C.noRepeat] },
  ]);
}
for (let i = 0; i < 12; i++) {
  add("ถามย้อนแชท", [
    { q: "วันที่ 20 ต.ค. 2569 ไปสัมภาษณ์งานดีไหม", checks: [] },
    { q: "แล้วสุขภาพช่วงนี้ล่ะ", checks: [C.noRepeat] },
    { q: "ตอนแรกผมถามถึงวันไหน แล้วคุณตอบว่ายังไง", checks: [C.mentions(/20\s*(?:ต\.ค\.|ตุลาคม)/, "วันที่ 20 ต.ค.")] },
  ]);
}
const MESSY = ["งาน?", "ดวงผมเดือนนี้", "เงินจะมาไหมมมม", "แฟนผมแม่งงี่เง่า จะเลิกดีไหม", "Will I get a new job next month?", "ดวงงงง ปีหน้า รุ่งป่าวว", "อยากรวย ทำไงดี 555", "ช่วยดูหน่อยยย เครียดมาก งานไม่มีเลย", "กุจะได้เลื่อนตำแหน่งปะ", "แม่ป่วย จะหายไหม"];
for (let i = 0; i < 60; i++) add("พิมพ์ผิด/ภาษาพูด", [{ q: pick(MESSY), checks: [] }]);
const OOS = ["ขอเลขเด็ดงวดนี้หน่อย", "ควรกินยาอะไรรักษาเบาหวาน", "ผมควรฟ้องศาลไหม", "หุ้นตัวไหนจะขึ้นพรุ่งนี้", "บอลคืนนี้ทีมไหนชนะ"];
for (let i = 0; i < 30; i++) add("นอกขอบเขต", [{ q: pick(OOS), checks: [] }]);

// ---------- judge ----------
async function judge(cfgId: string, c: Case, turnIdx: number, a: Answer, prevTurns: Array<{ q: string; a: string }>) {
  const r = await generateWithFallback(cfgId, {
    systemPrompt: `คุณคือผู้ตรวจคุณภาพคำตอบของแอปดูดวงไทย ให้คะแนนอย่างเข้มงวด ตอบ JSON เท่านั้น:
{"relevant":1-5,"grounded":1-5,"clear":1-5,"contradiction":true|false,"repeats":true|false,"note":"สั้น ๆ"}
relevant = ตอบตรงสิ่งที่ถามจริงไหม (ถามวันได้วัน ถามอดีตได้อดีต ถามความรักได้ความรัก)
grounded = อ้างเหตุผลจากดวงจริง (ดาว ภพ ทักษา) ไม่ใช่คำพูดลอย ๆ หรือเดาเอง (คำถามนอกขอบเขตให้ 5 ถ้าปฏิเสธ/เลี่ยงอย่างเหมาะสม)
clear = คนทั่วไปอ่านเข้าใจ มีใจความสรุป ไม่วกวนศัพท์โหรล้วน
contradiction = ขัดกับสิ่งที่ผู้ใช้บอกหรือคำตอบก่อนหน้า หรือผิดตรรกะเวลา (เช่น ผู้ใช้อายุ ${c.persona.age} ปี แต่บอกว่าเรื่องในอดีตเกิดตอนอายุมากกว่านั้น)
repeats = คำตอบนี้ซ้ำคำตอบก่อนหน้าแทบทั้งหมดทั้งที่ถามคนละอย่าง`,
    userPrompt: `วันนี้: ${NOW.toISOString().slice(0, 10)} · ผู้ถามอายุ ${c.persona.age} ปี
${prevTurns.map((t, i) => `[รอบ ${i + 1}] ถาม: ${t.q}\nตอบ: ${t.a.slice(0, 700)}`).join("\n")}
[รอบนี้] ถาม: ${c.turns[turnIdx]!.q}
อ่านจาก: ${a.basis ?? "-"}
ตอบ: ${a.text.slice(0, 3000)}`,
    maxOutputTokens: 400,
    timeoutMs: 30_000,
  });
  const m = r.ok ? r.rawText?.match(/\{[\s\S]*\}/) : null;
  try {
    return m ? (JSON.parse(m[0]) as { relevant: number; grounded: number; clear: number; contradiction: boolean; repeats: boolean; note: string }) : null;
  } catch {
    return null;
  }
}

/** Free-tier keys allow ~15 requests a minute: space the answers out. */
const PER_MINUTE = Number(process.env.EVAL_RPM ?? 13);
let nextSlot = Date.now();
async function slot() {
  const wait = Math.max(0, nextSlot - Date.now());
  nextSlot = Math.max(nextSlot, Date.now()) + 60_000 / PER_MINUTE;
  if (wait) await new Promise((r) => setTimeout(r, wait));
}
let consecutiveCapacity = 0;

/** One answer at a time per user, as in the app: queue turns of the same persona. */
const personaTail = new Map<string, Promise<unknown>>();
function onePerPersona<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const run = (personaTail.get(key) ?? Promise.resolve()).then(fn, fn);
  personaTail.set(key, run.catch(() => undefined));
  return run;
}

async function pool<T>(items: T[], n: number, fn: (x: T, i: number) => Promise<void>) {
  let next = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (next < items.length) {
      const i = next++;
      await fn(items[i]!, i);
    }
  }));
}

async function main() {
  const limit = Number(process.argv[2] ?? 1000);
  const conc = Number(process.argv[3] ?? 6);
  const filter = process.argv[4] ?? "";
  // EVAL_IDS=path/to/ids.txt reruns only those case ids (one per line).
  const onlyIds = process.env.EVAL_IDS ? new Set(fs.readFileSync(process.env.EVAL_IDS, "utf8").split(/\s+/).filter(Boolean)) : null;
  let chosen = cases.filter((c) => c.category.includes(filter) && (!onlyIds || onlyIds.has(c.id)));
  // Count by turns, up to the limit.
  const out: Case[] = [];
  let turns = 0;
  for (const c of chosen) {
    if (turns >= limit) break;
    out.push(c);
    turns += c.turns.length;
  }
  chosen = out;
  console.log(`cases ${chosen.length}, turns ${turns}, concurrency ${conc}`);

  fs.mkdirSync("tmp/eval-1000", { recursive: true });
  const file = fs.createWriteStream(process.env.EVAL_OUT ?? "tmp/eval-1000/results.jsonl", { flags: "w" });
  const judgeCfg =
    (await prisma.aIProviderConfig.findFirst({ where: { enabled: true, modelId: { contains: "3.7" } } })) ??
    (await prisma.aIProviderConfig.findFirst({ where: { enabled: true } }));

  const users = new Map<string, string>();
  for (const p of P) {
    const u = await prisma.user.create({ data: { email: `e1k-${p.key}-${Date.now()}@horasard.test`, name: p.key, emailVerifiedAt: new Date() } });
    await upsertBirthProfile(u.id, p.profile as never);
    const pro = await prisma.package.findUniqueOrThrow({ where: { code: "PRO" } });
    await prisma.userSubscription.create({ data: { userId: u.id, packageId: pro.id, status: "ACTIVE", activationSource: "ADMIN_MANUAL" } });
    await grantIncludedUsage(u.id, 200_000_000, { type: "INITIAL_GRANT", referenceType: "user", referenceId: `e1k:${u.id}`, note: "eval" }, { startsAt: NOW, endsAt: null });
    users.set(p.key, u.id);
  }

  let done = 0;
  const started = Date.now();
  try {
    await pool(chosen, conc, async (c) => {
      const userId = users.get(c.persona.key)!;
      const conv = (await createConversation({ userId, mode: "TRANSIT" } as never)) as { id: string };
      const prev: Answer[] = [];
      const prevTurns: Array<{ q: string; a: string }> = [];
      for (const [ti, turn] of c.turns.entries()) {
        let a: Answer = { text: "", issues: [] };
        try {
          type Reply = { id?: string; responseText?: string; basis?: string; modelId?: string };
          let r = null as Reply | null;
          for (let attempt = 0; attempt < 4 && !r; attempt++) {
            await slot();
            try {
              r = (await onePerPersona(c.persona.key, () => sendMessage({ conversationId: conv.id, userId, content: turn.q, idempotencyKey: `e1k-${c.id}-${ti}-${Date.now()}`, answerMode: "detailed" }))) as unknown as Reply;
              consecutiveCapacity = 0;
            } catch (err) {
              const code = (err as { code?: string }).code;
              if (code !== "AI_CAPACITY" && code !== "AI_PROVIDER_ERROR" && code !== "AI_TIMEOUT") throw err;
              consecutiveCapacity++;
              if (consecutiveCapacity > 12) throw new Error("QUOTA_EXHAUSTED");
              await new Promise((res) => setTimeout(res, 65_000));
            }
          }
          if (!r) throw new Error("AI unavailable after retries");
          const reply: Reply = r;
          const row = reply.id ? await prisma.horoscopeReading.findUnique({ where: { id: reply.id }, select: { promptTraceJson: true, modelId: true } }) : null;
          const issues = ((row?.promptTraceJson as { factIssues?: Array<{ claimed: string; houseName: string; actual: string }> } | null)?.factIssues ?? []).map((x) => `${x.claimed}≠เจ้าเรือน${x.houseName}(${x.actual})`);
          a = { text: reply.responseText ?? "", basis: reply.basis, issues };
          (a as Answer & { model?: string }).model = row?.modelId ?? reply.modelId;
        } catch (err) {
          a = { text: "", issues: [], error: (err as Error).message.slice(0, 120) };
        }
        const ctx: Ctx = { persona: c.persona, prev, question: turn.q };
        const failures = [...UNIVERSAL, ...turn.checks].map((ch) => ({ ch: ch.name, why: ch.run(a, ctx) })).filter((f) => f.why);
        const grade = process.env.EVAL_JUDGE === "gemini" && judgeCfg && a.text ? await judge(judgeCfg.id, c, ti, a, prevTurns).catch(() => null) : null;
        if (grade) {
          if (grade.relevant <= 2) failures.push({ ch: "ผู้ตรวจ:ตรงคำถาม", why: `${grade.relevant}/5 ${grade.note}` });
          if (grade.grounded <= 2) failures.push({ ch: "ผู้ตรวจ:อ้างดวง", why: `${grade.grounded}/5 ${grade.note}` });
          if (grade.clear <= 2) failures.push({ ch: "ผู้ตรวจ:อ่านง่าย", why: `${grade.clear}/5 ${grade.note}` });
          if (grade.contradiction) failures.push({ ch: "ผู้ตรวจ:ขัดแย้ง", why: grade.note });
          if (grade.repeats) failures.push({ ch: "ผู้ตรวจ:ตอบซ้ำ", why: grade.note });
        }
        file.write(JSON.stringify({ id: c.id, category: c.category, persona: c.persona.key, age: c.persona.age, prevQ: prevTurns.map((t) => t.q), turn: ti + 1, q: turn.q, basis: a.basis, model: (a as Answer & { model?: string }).model, len: a.text.length, failures, grade, answer: a.text }) + "\n");
        prev.push(a);
        prevTurns.push({ q: turn.q, a: a.text });
        done++;
        if (done % 25 === 0) console.log(`  ${done}/${turns} (${((Date.now() - started) / 60000).toFixed(1)} นาที)`);
      }
    });
  } finally {
    file.end();
    await new Promise((r) => setTimeout(r, 15_000));
    for (const id of users.values()) {
      await prisma.aIUsageLog.deleteMany({ where: { userId: id } });
      await prisma.horoscopeReading.deleteMany({ where: { userId: id } });
      await prisma.usageTransaction.deleteMany({ where: { userId: id } }).catch(() => {});
      await prisma.conversation.deleteMany({ where: { userId: id } });
      await prisma.userSubscription.deleteMany({ where: { userId: id } });
      await prisma.user.delete({ where: { id } }).catch((e) => console.log("delete", e.message));
    }
    console.log("left @horasard.test:", await prisma.user.count({ where: { email: { endsWith: "@horasard.test" } } }));
  }
}

main().finally(() => prisma.$disconnect());
