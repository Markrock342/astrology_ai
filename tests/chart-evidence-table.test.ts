import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ChartEvidenceTable } from "@/components/app/chart-evidence-table";
import type { ChartJson } from "@/types/chart";

describe("full chart evidence table", () => {
  it("renders the complete MyHora fields and explains standards found in the chart", () => {
    const chart = {
      meta: { lagna: "กันย์" },
      chart: { lagna: "กันย์", taksa: [] },
      planets: [
        {
          planet: "อังคาร",
          siderealSign: "มกร",
          degreeText: "20°55′ ส.",
        },
      ],
      myhora: {
        natalPlanets: [
          {
            planet: "๓.อังคาร",
            zodiac: "09 : มก",
            degree: "20",
            minute: "55 ส.",
            house: "ปุตตะ",
            triyang: "3 : 4 : กน",
            poison: "สุนัข",
            nawamang: "7 : 2 : กฎ",
            rerk: "21 : 49",
            rerkName: "ศรวณะ",
            baht: "จตุตถ",
            rerk2: "บูรณ",
            rerkBig: "ภูมิปาโล",
            rerkOwner: "มรณะ สหัชชะ",
            rerkStandard: "มหาอุจจ์",
          },
        ],
      },
    } as unknown as ChartJson;

    const html = renderToStaticMarkup(
      createElement(ChartEvidenceTable, { chart }),
    );

    for (const value of [
      "ตรียางค์",
      "สุนัข",
      "นวางศ์",
      "21 : 49",
      "ศรวณะ",
      "จตุตถ",
      "บูรณ",
      "ภูมิปาโล",
      "มรณะ สหัชชะ",
      "มหาอุจจ์",
      "มาตรฐานและเกณฑ์ที่พบในดวงนี้",
    ]) {
      expect(html).toContain(value);
    }
  });
});
