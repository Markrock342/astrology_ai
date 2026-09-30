/**
 * ดวงสมพงษ์ from the team's own site (astro.meemodel.com): birth weekday,
 * lunar birth month and animal year, scored by the classical Thai table. It
 * does the lunar-calendar and นักษัตร conversion we do not have, answers a
 * plain form post, and sits behind no bot challenge.
 *
 * Only dates are sent — placeholder names, since the name does not change
 * the score — and the result is used for this answer only.
 */

const DEFAULT_URL = "https://astro.meemodel.com/ajax/3-lovepoint.php";
const TIMEOUT_MS = 6_000;
/** The site's year list runs พ.ศ. 2459–2574 (1916–2031). */
const FIRST_BE = 2459;
const LAST_BE = 2574;

export type SompongFactor = {
  factor: "วันที่เกิด" | "เดือนที่เกิด" | "ปีที่เกิด";
  a: string;
  b: string;
  verdict: string;
};

export type SompongResult = {
  score: number;
  band: string;
  factors: SompongFactor[];
};

/**
 * The site's own legend. Its ranges touch at the ends ("20–30", "0–20"), so a
 * shared edge goes to the better band — 20 is "สมพงษ์กันดี".
 */
export function sompongBand(score: number): string {
  if (score > 30) return "ดวงสมพงษ์เหมาะสมกันอย่างยิ่ง จะช่วยส่งเสริมอนาคตให้ดีมาก";
  if (score >= 20) return "ดวงชะตาสมพงษ์กันดี";
  if (score >= 0) return "สมพงษ์กันปานกลาง";
  if (score >= -30) return "ดวงชะตาไม่ค่อยสมพงษ์ มีปัญหาและอุปสรรค";
  return "ดวงชะตาไม่เหมาะสมกันเลย จะพบแต่อุปสรรคและปัญหามากมาย";
}

function cellText(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

/** Read the score and the three factor rows out of the site's HTML. */
export function parseSompongHtml(html: string): SompongResult | null {
  const plain = cellText(html);
  const score = plain.match(/ได้คะแนนดังนี้\s*(-?\d+)/)?.[1];
  if (score === undefined) return null;

  const factors: SompongFactor[] = [];
  for (const row of html.matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
    const cells = [...row[1]!.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => cellText(m[1]!));
    const [factor, a, b, verdict] = cells;
    if (
      (factor === "วันที่เกิด" || factor === "เดือนที่เกิด" || factor === "ปีที่เกิด") &&
      a &&
      b &&
      verdict
    ) {
      factors.push({ factor, a, b, verdict });
    }
  }
  // A malformed request comes back scored 0 with empty month and year rows —
  // that is not a verdict, so it is not passed on as one.
  if (factors.length < 3) return null;
  return { score: Number(score), band: sompongBand(Number(score)), factors };
}

type Birth = { year: number; month: number; day: number };

export async function fetchSompong(a: Birth, b: Birth): Promise<SompongResult | null> {
  const be = (y: number) => y + 543;
  if ([a, b].some((d) => be(d.year) < FIRST_BE || be(d.year) > LAST_BE)) return null;

  const body = new URLSearchParams({
    name: "A",
    day: String(a.day),
    month: String(a.month).padStart(2, "0"),
    year: String(be(a.year)),
    name2: "B",
    day2: String(b.day),
    month2: String(b.month).padStart(2, "0"),
    year2: String(be(b.year)),
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(process.env.SOMPONG_URL || DEFAULT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(`[sompong] HTTP ${res.status}`);
      return null;
    }
    return parseSompongHtml(await res.text());
  } catch (err) {
    // The reading goes ahead without it; the chart comparison still stands.
    console.warn("[sompong] unavailable:", err instanceof Error ? err.message : err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function formatSompongForPrompt(index: number, name: string, r: SompongResult): string[] {
  const row = (f: SompongFactor) => `${f.factor.replace("ที่", "")} ${f.a}–${f.b} ${f.verdict}`;
  return [
    `[sompong_${index}] ดวงสมพงษ์ตามตำราโหราศาสตร์ไทยของผู้ถามกับ${name} ` +
      "(คำนวณจากวันเกิด เดือนจันทรคติ และปีนักษัตรแล้ว ห้ามคิดคะแนนเอง):",
    `- คะแนน ${r.score} · ${r.band}`,
    `- รายละเอียด (ผู้ถาม–${name}): ${r.factors.map(row).join(" · ")}`,
  ];
}
