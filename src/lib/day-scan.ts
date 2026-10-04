import type { PlanetSignRow, TaksaSlot } from "@/types/chart";
import { HOUSE_NAMES } from "@/lib/chart-theme";
import { linkTransitToNatal } from "@/lib/transit-to-natal";

/**
 * "Which day is good for …?" — answered by walking the days, not by guessing.
 *
 * A time phrase used to resolve to ONE day ("เดือนหน้า" = the same date next
 * month), so a question that asks the model to choose a day gave it a single
 * sky and nothing to choose from; the user had to pick dates one by one. This
 * walks every day of the window and records, for each, the facts a Thai
 * reading picks a day on — the weekday's role in the person's own ทักษา
 * (avoid their วันกาลกิณี), where the Moon walks through their chart and
 * what it touches, and which moving planets stand in the houses of the topic
 * — then ranks the days so the model picks from real dates.
 *
 * The score only orders the list; the reasons are what the answer must use.
 */

export type DayFacts = {
  date: Date;
  weekday: string;
  /** Role of the weekday's planet in the person's ทักษา, e.g. "ศรี". */
  dayRole: string | null;
  moonSign: string;
  moonHouse: number;
  reasons: string[];
  score: number;
};

export type DayScan = {
  from: Date;
  to: Date;
  /** True when the window asked for was longer than the scan. */
  truncated: boolean;
  topicHouses: number[];
  best: DayFacts[];
  avoid: DayFacts[];
  all?: DayFacts[];
};

export type DayPositionsAt = (date: Date) => PlanetSignRow[];

const WEEKDAY = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];

/** ทักษา roles a day can carry, and how a day of that role reads. */
const ROLE_WEIGHT: Record<string, number> = {
  ศรี: 2, มนตรี: 2, เดช: 1, บริวาร: 1, อายุ: 1, อุตสาหะ: 0, มูละ: 0, กาลกิณี: -3,
};
// Weekday roles in the BIRTH ทักษา. The model kept calling them "ศรีจร" — the
// age-based ทักษาจร is a different thing — so the note says which it is.
const ROLE_NOTE: Record<string, string> = {
  ศรี: "วันศรีของคุณ ตามทักษากำเนิด (โชคลาภ ความราบรื่น)",
  มนตรี: "วันมนตรีของคุณ ตามทักษากำเนิด (มีผู้อุปถัมภ์ช่วยเหลือ)",
  เดช: "วันเดชของคุณ ตามทักษากำเนิด (อำนาจ ความเด็ดขาด)",
  บริวาร: "วันบริวารของคุณ ตามทักษากำเนิด (คนรอบข้าง ลูกน้อง ครอบครัว)",
  อายุ: "วันอายุของคุณ ตามทักษากำเนิด (สุขภาพ ความเป็นอยู่)",
  อุตสาหะ: "วันอุตสาหะของคุณ ตามทักษากำเนิด (ต้องลงแรง)",
  มูละ: "วันมูละของคุณ ตามทักษากำเนิด (ทรัพย์ ฐานเดิม)",
  กาลกิณี: "วันกาลกิณีของคุณ ตามทักษากำเนิด (ควรเลี่ยงเริ่มเรื่องสำคัญ)",
};

const BENEFIC = new Set(["พฤหัสบดี", "ศุกร์"]);
const MALEFIC = new Set(["เสาร์", "ราหู", "อังคาร"]);
const GOOD_MOON_HOUSES = new Set([1, 5, 9, 10, 11]);
const HARD_MOON_HOUSES = new Set([6, 8, 12]);

function bangkokWeekday(date: Date): number {
  return new Date(date.getTime() + 7 * 3_600_000).getUTCDay();
}

/** Planet number of a weekday (Sun 1 … Sat 7) — a day starts at sunrise, so a 09:00 sample is that weekday's. */
const WEEKDAY_PLANET = [1, 2, 3, 4, 5, 6, 7];
const PLANET_BY_NUM: Record<number, string> = {
  1: "อาทิตย์", 2: "จันทร์", 3: "อังคาร", 4: "พุธ", 5: "พฤหัสบดี", 6: "ศุกร์", 7: "เสาร์",
};

export function scanDays(input: {
  natalLagna: string | null | undefined;
  natalPlanets: PlanetSignRow[];
  natalTaksa: TaksaSlot[];
  topicHouses: number[];
  days: Date[];
  positionsAt: DayPositionsAt;
  truncated?: boolean;
  /** Keep every day's facts (for checking one named day against its week). */
  keepAll?: boolean;
}): DayScan | null {
  if (!input.days.length) return null;
  const roleOf = new Map(
    input.natalTaksa.filter((s) => s.planet).map((s) => [s.planet, s.taksa] as const),
  );
  const topic = new Set(input.topicHouses);

  const facts: DayFacts[] = input.days.map((date) => {
    const reasons: string[] = [];
    let score = 0;

    const wd = bangkokWeekday(date);
    const dayPlanet = PLANET_BY_NUM[WEEKDAY_PLANET[wd]!]!;
    const dayRole = roleOf.get(dayPlanet) ?? null;
    if (dayRole) {
      score += ROLE_WEIGHT[dayRole] ?? 0;
      reasons.push(ROLE_NOTE[dayRole] ?? `วัน${dayRole}ของคุณ ตามทักษากำเนิด`);
    }

    const links = linkTransitToNatal({
      natalLagna: input.natalLagna,
      natalPlanets: input.natalPlanets,
      transitPlanets: input.positionsAt(date),
    });
    const moon = links.find((l) => l.transitPlanet === "จันทร์");
    if (moon && moon.natalHouse) {
      const name = HOUSE_NAMES[moon.natalHouse - 1];
      if (GOOD_MOON_HOUSES.has(moon.natalHouse)) score += 1;
      if (HARD_MOON_HOUSES.has(moon.natalHouse)) score -= 1;
      if (topic.has(moon.natalHouse)) score += 1;
      reasons.push(
        `จันทร์จรเดินภพ ${moon.natalHouse} ${name}` + (topic.has(moon.natalHouse) ? " (ภพของเรื่องที่ถาม)" : ""),
      );
      for (const c of moon.contacts) {
        if (c.natalBody === "ลัคนา" && c.kind === "กุม") {
          score += 1;
          reasons.push("จันทร์จรกุมลัคนาเดิม");
        } else if (BENEFIC.has(c.natalBody) && (c.kind === "กุม" || c.kind === "ตรีโกณ")) {
          score += 1;
          reasons.push(`จันทร์จร${c.kind}${c.natalBody}เดิม`);
        } else if (MALEFIC.has(c.natalBody) && (c.kind === "กุม" || c.kind === "เล็ง")) {
          score -= 1;
          reasons.push(`จันทร์จร${c.kind}${c.natalBody}เดิม`);
        }
      }
    }
    for (const link of links) {
      if (!link.natalHouse || !topic.has(link.natalHouse)) continue;
      if (BENEFIC.has(link.transitPlanet)) {
        score += 1;
        reasons.push(`${link.transitPlanet}จรอยู่ภพ ${link.natalHouse} ${HOUSE_NAMES[link.natalHouse - 1]}`);
      } else if (MALEFIC.has(link.transitPlanet)) {
        score -= 1;
        reasons.push(`${link.transitPlanet}จรอยู่ภพ ${link.natalHouse} ${HOUSE_NAMES[link.natalHouse - 1]}`);
      }
    }

    return {
      date,
      weekday: WEEKDAY[wd]!,
      dayRole,
      moonSign: moon?.transitSign ?? "—",
      moonHouse: moon?.natalHouse ?? 0,
      reasons,
      score,
    };
  });

  const byScore = [...facts].sort((a, b) => b.score - a.score || a.date.getTime() - b.date.getTime());
  if (input.keepAll) {
    return {
      from: input.days[0]!,
      to: input.days[input.days.length - 1]!,
      truncated: false,
      topicHouses: input.topicHouses,
      best: byScore.filter((d) => d.dayRole !== "กาลกิณี").slice(0, 5),
      avoid: [],
      all: facts,
    };
  }
  const best = byScore.filter((d) => d.dayRole !== "กาลกิณี").slice(0, 5);
  const avoid = [...facts]
    .sort((a, b) => a.score - b.score || a.date.getTime() - b.date.getTime())
    .filter((d) => d.score < 0)
    .slice(0, 4);
  return {
    from: input.days[0]!,
    to: input.days[input.days.length - 1]!,
    truncated: Boolean(input.truncated),
    topicHouses: input.topicHouses,
    best,
    avoid,
  };
}

const THAI_MONTH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

export function thaiDayLabel(date: Date): string {
  const b = new Date(date.getTime() + 7 * 3_600_000);
  return `${b.getUTCDate()} ${THAI_MONTH[b.getUTCMonth()]} ${b.getUTCFullYear() + 543}`;
}

export function formatDayScanForPrompt(scan: DayScan): string[] {
  const lines = [
    `[day_scan] ไล่ดาวจรทีละวัน ${thaiDayLabel(scan.from)} – ${thaiDayLabel(scan.to)} ` +
      "(ตำแหน่งดาวเวลา 09:00 คำนวณกับพื้นดวงของผู้ถามแล้ว ห้ามเดาวันเอง — เลือกวันจากบล็อกนี้เท่านั้น):",
  ];
  if (scan.truncated) lines.push("- ช่วงที่ถามยาวกว่าที่ไล่ได้ ไล่ให้ถึงวันสุดท้ายข้างต้น");
  if (scan.topicHouses.length) {
    lines.push(`- ภพของเรื่องที่ถาม: ${scan.topicHouses.map((h) => `${h} ${HOUSE_NAMES[h - 1]}`).join(" · ")}`);
  }
  lines.push("- วันเด่น (เรียงจากเกณฑ์มากไปน้อย):");
  for (const d of scan.best) {
    lines.push(`  · วัน${d.weekday}ที่ ${thaiDayLabel(d.date)} [${d.score >= 0 ? "+" : ""}${d.score}] ${d.reasons.join(" · ")}`);
  }
  if (scan.avoid.length) {
    lines.push("- วันที่ควรเลี่ยง:");
    for (const d of scan.avoid) {
      lines.push(`  · วัน${d.weekday}ที่ ${thaiDayLabel(d.date)} [${d.score}] ${d.reasons.join(" · ")}`);
    }
  }
  return lines;
}

/**
 * One named day ("14 ผมมีนัดคุยงาน") with the facts of that day, and the
 * better days around it in case the plan can move.
 */
export function formatDayCheckForPrompt(scan: DayScan, asked: Date): string[] {
  const key = thaiDayLabel(asked);
  const day = scan.all?.find((d) => thaiDayLabel(d.date) === key);
  if (!day) return [];
  const lines = [
    `[day_check] วันที่ผู้ถามพูดถึง: วัน${day.weekday}ที่ ${key} ` +
      "(ตำแหน่งดาวเวลา 09:00 คำนวณกับพื้นดวงของผู้ถามแล้ว ห้ามเดาเอง):",
    `- เกณฑ์ของวันนั้น [${day.score >= 0 ? "+" : ""}${day.score}] ${day.reasons.join(" · ") || "ไม่มีเกณฑ์เด่น"}`,
  ];
  const better = scan.best.filter((d) => d.score > day.score && thaiDayLabel(d.date) !== key).slice(0, 2);
  if (better.length) {
    lines.push("- วันใกล้ ๆ ที่เกณฑ์ดีกว่า (ถ้าเลื่อนได้):");
    for (const d of better) {
      lines.push(`  · วัน${d.weekday}ที่ ${thaiDayLabel(d.date)} [${d.score >= 0 ? "+" : ""}${d.score}] ${d.reasons.join(" · ")}`);
    }
  }
  return lines;
}

