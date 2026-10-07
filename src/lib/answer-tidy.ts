/**
 * Mechanical fixes on a finished answer — things a reader trips on that need
 * no model to put right. Graders found "วันจันทร์ที่ 25 ต.ค. 2569" (a Sunday),
 * "[timeline]" and "March" in Thai answers.
 */

const WEEKDAYS = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
const MONTHS: Array<[RegExp, number]> = [
  [/^(?:ม\.?ค\.?|มกรา(?:คม)?)$/, 0],
  [/^(?:ก\.?พ\.?|กุมภา(?:พันธ์)?)$/, 1],
  [/^(?:มี\.?ค\.?|มีนา(?:คม)?)$/, 2],
  [/^(?:เม\.?ย\.?|เมษา(?:ยน)?)$/, 3],
  [/^(?:พ\.?ค\.?|พฤษภา(?:คม)?)$/, 4],
  [/^(?:มิ\.?ย\.?|มิถุนา(?:ยน)?)$/, 5],
  [/^(?:ก\.?ค\.?|กรกฎา(?:คม)?)$/, 6],
  [/^(?:ส\.?ค\.?|สิงหา(?:คม)?)$/, 7],
  [/^(?:ก\.?ย\.?|กันยา(?:ยน)?)$/, 8],
  [/^(?:ต\.?ค\.?|ตุลา(?:คม)?)$/, 9],
  [/^(?:พ\.?ย\.?|พฤศจิกา(?:ยน)?)$/, 10],
  [/^(?:ธ\.?ค\.?|ธันวา(?:คม)?)$/, 11],
];
const MONTH_WORD =
  "ม\\.?ค\\.?|ก\\.?พ\\.?|มี\\.?ค\\.?|เม\\.?ย\\.?|พ\\.?ค\\.?|มิ\\.?ย\\.?|ก\\.?ค\\.?|ส\\.?ค\\.?|ก\\.?ย\\.?|ต\\.?ค\\.?|พ\\.?ย\\.?|ธ\\.?ค\\.?|" +
  "มกรา(?:คม)?|กุมภา(?:พันธ์)?|มีนา(?:คม)?|เมษา(?:ยน)?|พฤษภา(?:คม)?|มิถุนา(?:ยน)?|กรกฎา(?:คม)?|สิงหา(?:คม)?|กันยา(?:ยน)?|ตุลา(?:คม)?|พฤศจิกา(?:ยน)?|ธันวา(?:คม)?";
const WEEKDAY_DATE = new RegExp(
  `วัน(อาทิตย์|จันทร์|อังคาร|พุธ|พฤหัสบดี|พฤหัส|ศุกร์|เสาร์)(\\s*ที่\\s*|\\s+)([0-9๐-๙]{1,2})\\s*(${MONTH_WORD})(?:\\s*(?:พ\\.ศ\\.\\s*)?([0-9๐-๙]{4}))?`,
  "g",
);

const arabic = (s: string) => s.replace(/[๐-๙]/g, (c) => String(c.charCodeAt(0) - 0x0e50));

/** "วันจันทร์ที่ 25 ต.ค. 2569" → "วันอาทิตย์ที่ 25 ต.ค. 2569" when the 25th is a Sunday. */
export function fixWeekdayClaims(text: string, now: Date): string {
  return text.replace(WEEKDAY_DATE, (all, wd: string, sep: string, dayS: string, monthS: string, yearS?: string) => {
    const day = Number(arabic(dayS));
    const month = MONTHS.find(([re]) => re.test(monthS))?.[1];
    if (month === undefined || day < 1 || day > 31) return all;
    let year: number;
    if (yearS) {
      const y = Number(arabic(yearS));
      year = y > 2400 ? y - 543 : y;
    } else {
      // No year: the one that puts the day nearest today.
      const y0 = now.getUTCFullYear();
      year = [y0 - 1, y0, y0 + 1].reduce((best, y) =>
        Math.abs(Date.UTC(y, month, day) - now.getTime()) < Math.abs(Date.UTC(best, month, day) - now.getTime()) ? y : best,
      );
    }
    const date = new Date(Date.UTC(year, month, day));
    if (date.getUTCMonth() !== month) return all;
    const truth = WEEKDAYS[date.getUTCDay()]!;
    const claimed = wd === "พฤหัส" ? "พฤหัสบดี" : wd;
    return claimed === truth ? all : all.replace(`วัน${wd}`, `วัน${truth}`);
  });
}

const EN_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const TH_MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

/** Prompt block names ("[timeline]") and English month names out of a Thai answer. */
export function stripInternalMarks(text: string): string {
  return text
    .replace(/(?:ใน|จาก|ตาม)?(?:ข้อมูล)?\s*(?:บล็อก\s*)?\[[a-z][a-z_]{2,}\]/g, (m) => (/^(?:ใน|จาก|ตาม)/.test(m) ? `${m.match(/^(?:ใน|จาก|ตาม)/)![0]}ดวงของคุณ` : ""))
    .replace(/บล็อก/g, "ข้อมูลดวง")
    // Labels from the data copied into the answer, and doubled words.
    .replace(/\s*\(ภพของเรื่องที่ถาม\)/g, "")
    .replace(/ภพของเรื่องที่ถาม/g, "เรื่องที่คุณถาม")
    .replace(/ผู้ถาม/g, "คุณ")
    .replace(/(ภพ|จร|ดาว|เรือน)\1/g, "$1")
    // Day scores ("[+4]") and planet numbers ("ศุกร์(6)") from the data blocks.
    .replace(/\s*\[[+\-−]?\d+\]/g, "")
    .replace(/(อาทิตย์|จันทร์|อังคาร|พุธ|พฤหัสบดี|พฤหัส|ศุกร์|เสาร์|ราหู|เกตุ|มฤตยู)\s*\([0-9๐-๙]\)/g, "$1")
    .replace(new RegExp(`(?<![A-Za-z])(${EN_MONTHS.join("|")})(?![A-Za-z])`, "g"), (m) => TH_MONTHS[EN_MONTHS.indexOf(m)]!);
}

export function tidyAnswer(text: string, now: Date): string {
  return fixWeekdayClaims(stripInternalMarks(text), now);
}
