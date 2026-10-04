import { describe, expect, it } from "vitest";
import { assertMyhoraUsedBirthplace } from "@/server/horoscope/engine/compute-chart";

// Coordinate lines exactly as production returned them in QA (4 Oct 2026).
const scrape = (raw: string) => ({ tables: { dateDetailNatal: { raw } } }) as never;
const birth = (province: string, district: string) =>
  ({ day: 1, month: 1, year: 2000, time: "12:00", country: "ไทย", province, district }) as never;

describe("a myhora chart computed for the wrong place", () => {
  it("is refused when myhora used the provincial capital instead of the district", () => {
    // ชุมแพ asked; myhora printed อ.เมือง จ.ขอนแก่น.
    expect(() =>
      assertMyhoraUsedBirthplace(birth("ขอนแก่น", "ชุมแพ"), scrape("อ.เมือง จ.ขอนแก่น (UTC+07:00) ละติจูด 16.4383° ลองจิจูด 102.838°")),
    ).toThrow(/myhora computed at 16\.438,102\.838/);
  });

  it("is accepted when myhora used the district", () => {
    expect(() =>
      assertMyhoraUsedBirthplace(birth("กรุงเทพมหานคร", "บางกะปิ"), scrape("เขตบางกะปิ จ.กรุงเทพมหานคร (UTC+07:00) ละติจูด 13.7657° ลองจิจูด 100.647°")),
    ).not.toThrow();
  });

  it("is accepted when myhora printed no coordinates", () => {
    expect(() => assertMyhoraUsedBirthplace(birth("ขอนแก่น", "ชุมแพ"), scrape(""))).not.toThrow();
  });
});
