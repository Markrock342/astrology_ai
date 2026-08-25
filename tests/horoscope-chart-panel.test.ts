import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EvidenceGrid } from "@/components/app/horoscope-chart-panel";
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
      }),
    );
    expect(html).toContain("ทักษากำเนิด");
    expect(html).toContain("วันอาทิตย์");
    expect(html).toContain("บริวาร");
    expect(html).toContain("๑");
  });
});
