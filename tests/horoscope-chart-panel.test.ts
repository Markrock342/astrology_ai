import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EvidenceGrid } from "@/components/app/horoscope-chart-panel";
import { computeTransitTaksaByAge } from "@/lib/taksa";
import { TaksaNineGrid } from "@/components/app/taksa-nine-grid";

describe("horoscope chart evidence grids", () => {
  it("renders every Taksa transit label returned by MyHora", () => {
    const html = renderToStaticMarkup(
      createElement(EvidenceGrid, {
        title: "ทักษาอ้างอิง · กำเนิดและจร",
        kind: "taksa",
        cells: [
          [
            {
              label: "มูละ",
              planetNum: 1,
              transitLabel: "กาลกิณีจร",
            },
          ],
        ],
      }),
    );

    expect(html).toContain("มูละ");
    expect(html).toContain("กาลกิณีจร");
  });

  it("removes the empty scraped row and restores the Triwai footer", () => {
    const html = renderToStaticMarkup(
      createElement(EvidenceGrid, {
        title: "ตรีวัย",
        kind: "triwai",
        cells: [
          [
            { house: "ตนุ", planetNum: 5, ageRange: "0 - 8.4 ปี" },
            { house: "สหัสชะ", planetNum: 8, ageRange: "25 - 33.4 ปี" },
            { house: "พันธุ", planetNum: 5, ageRange: "50 - 58.4 ปี" },
            { house: "อริ", planetNum: 6, ageRange: "75 - 83.4 ปี" },
          ],
          [null, null, null, null],
        ],
      }),
    );

    expect(html).toContain("วัยต้น");
    expect(html).toContain("วัยกลาง");
    expect(html).toContain("วัยปลาย");
    expect(html).toContain("วัยเทียบ");
    expect(html).toContain("นับตรีวัยจาก");
    expect(html).toContain("ตนุเศษ");
  });

  it("renders the gold template grid for Sunday natal (บริวาร at ๑)", () => {
    const html = renderToStaticMarkup(
      createElement(TaksaNineGrid, {
        input: {
          day: 23,
          month: 8,
          year: 2026,
          time: "12:00",
          country: "ไทย",
          province: "กรุงเทพมหานคร",
          district: "วัฒนา",
        },
        mode: "natal",
        asOf: new Date(2026, 7, 25),
      }),
    );
    expect(html).toContain("ทักษากำเนิด");
    expect(html).toContain("วันอาทิตย์");
    expect(html).toContain("บริวาร");
    expect(html).toContain("๑");
    expect(html).toContain("๙");
  });

  it("walks ทักษาจร by อายุย่าง to the date on screen, from one source only", () => {
    // Client's rule, their own example: born a Sunday, reading a day in 2571
    // (2028) at อายุย่าง ๕๒ → บริวารจร sits on ๕ (พฤหัสบดี).
    // Regression: the grid used to prefer the MyHora overlay scraped with the
    // NATAL chart, whose จร labels belong to the day of that scrape, so the
    // grid contradicted its own heading and the answer written beside it.
    const sundayBorn = {
      day: 2,
      month: 1,
      year: 1977,
      time: "12:00",
      country: "ไทย",
      province: "กรุงเทพมหานคร",
      district: "วัฒนา",
    };
    const byAge = computeTransitTaksaByAge(
      sundayBorn,
      new Date(2028, 11, 31),
      true,
    );
    expect(byAge.yangKao).toBe(52);
    expect(
      byAge.slots.find((slot) => slot.taksa === "บริวารจร")?.planetNum,
    ).toBe(5);

    const html = renderToStaticMarkup(
      createElement(TaksaNineGrid, {
        input: sundayBorn,
        mode: "transit",
        asOf: new Date(2028, 11, 31),
        onCountFromCenterChange: () => {},
      }),
    );
    expect(html).toContain("ทักษาจร");
    expect(html).toContain("บริวารจร");
    expect(html).toContain("อายุย่างเข้า ๕๒");
    expect(html).toContain("นับอายุจรตากลาง");
  });
});
