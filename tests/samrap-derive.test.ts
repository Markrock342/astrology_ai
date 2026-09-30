import { describe, expect, it } from "vitest";
import { deriveSamrapColumns, fillSamrapRows, rowLongitude } from "@/lib/samrap-derive";
import { collectAstrologyStandards } from "@/lib/astrology-standard-glossary";

// Rows exactly as myhora printed them (18 Nov 2001 02:08 กรุงเทพฯ, ลัคนา กันย์).
const MYHORA = [
  { planet: "๑.อาทิตย์", zodiac: "07 : พจ", degree: "01", minute: "08", triyang: "1 : 3 : พจ", nawamang: "1 : 2 : กฎ", rerk: "15 : 50", rerkName: "วิสาขะ", baht: "จตุตถ", rerkBig: "เพชฌฆาต", rerkOwner: "วินาศ" },
  { planet: "๒.จันทร์", zodiac: "08 : ธน", degree: "03", minute: "37", triyang: "1 : 5 : ธน", nawamang: "2 : 6 : พภ", rerk: "18 : 16", rerkName: "มูละ", baht: "ทุติย", rerkBig: "ทลิทโท", rerkOwner: "ลาภะ" },
  { planet: "๓.อังคาร", zodiac: "09 : มก", degree: "20", minute: "55 ส.", triyang: "3 : 4 : กน", nawamang: "7 : 2 : กฎ", rerk: "21 : 49", rerkName: "ศรวณะ", baht: "จตุตถ", rerkBig: "ภูมิปาโล", rerkOwner: "มรณะ สหัชชะ" },
  { planet: "ล.ลัคนา", zodiac: "05 : กน", degree: "12", minute: "55", triyang: "2 : 7 : มก", nawamang: "4 : 3 : มษ", rerk: "12 : 13", rerkName: "หัสตะ", baht: "ปฐม", rerkBig: "ภูมิปาโล", rerkOwner: "" },
];

describe("derived สมผุส columns", () => {
  it.each(MYHORA)("reproduces myhora's row for $planet", (row) => {
    const lon = rowLongitude(row)!;
    const d = deriveSamrapColumns(row.planet, lon, "กันย์");
    expect(d.triyang).toBe(row.triyang);
    expect(d.nawamang).toBe(row.nawamang);
    expect(d.rerk).toBe(row.rerk);
    expect(d.rerkName).toBe(row.rerkName);
    expect(d.baht).toBe(row.baht);
    expect(d.rerkBig).toBe(row.rerkBig);
    expect(d.rerkOwner).toBe(row.rerkOwner);
  });

  it("names เสาร์ for กุมภ์ in ตรียางค์ and ราหู in นวางศ์, as myhora does", () => {
    // Jupiter มิถุน 22°54', Venus ตุลย์ 15°21' in myhora's table.
    expect(deriveSamrapColumns("พฤหัสบดี", 60 + 22.9, "กันย์").triyang).toBe("3 : 7 : กภ");
    expect(deriveSamrapColumns("ศุกร์", 180 + 15 + 21 / 60, "กันย์").nawamang).toBe("5 : 8 : กภ");
  });

  it("marks standards the glossary knows", () => {
    expect(deriveSamrapColumns("อังคาร", 290.9, "กันย์").rerkStandard).toBe("มหาอุจจ์");
    expect(deriveSamrapColumns("จันทร์", 243.6, "กันย์").rerkStandard).toBe("เรือนเกณฑ์");
    expect(deriveSamrapColumns("เกตุ", 353.5, "กันย์").rerkStandard).toBe("");
  });
});

describe("a ดวงจร table from myhora", () => {
  // Sign and degree only — the detail columns come back empty.
  const transit = [
    { planet: "๗.เสาร์", zodiac: "01 : มษ", degree: "05", minute: "10", house: "", triyang: "", poison: "", nawamang: "", rerk: "", rerkName: "", baht: "", rerk2: "", rerkBig: "", rerkOwner: "", rerkStandard: "" },
  ];

  it("gets every derivable column filled", () => {
    const [row] = fillSamrapRows(transit, "กรกฎ");
    expect(row!.nawamang).toBe("2 : 6 : พภ");
    expect(row!.rerkName).toBe("อัศวินี");
    expect(row!.rerkStandard).toBe("นิจ เรือนเกณฑ์");
    expect(row!.poison).toBe("");
  });

  it("feeds the standards section", () => {
    const found = collectAstrologyStandards(fillSamrapRows(transit, "กรกฎ"));
    expect(found.map((f) => f.matchKey)).toEqual(expect.arrayContaining(["นิจ", "เรือนเกณฑ์"]));
  });

  it("keeps columns the source supplied", () => {
    const [row] = fillSamrapRows([{ ...transit[0]!, rerkStandard: "มหาจักร" }], "กรกฎ");
    expect(row!.rerkStandard).toBe("มหาจักร");
  });
});
