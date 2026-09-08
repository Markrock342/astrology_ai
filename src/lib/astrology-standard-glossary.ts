import type { MyhoraNatalPlanet } from "@/types/myhora";

export type AstrologyStandardGroup = "มาตรฐานดาว" | "เกณฑ์ประกอบ";

export type AstrologyStandardEntry = {
  matchKey: string;
  term: string;
  group: AstrologyStandardGroup;
  meaning: string;
  planets: string[];
};

export type StandardGlossaryItem = {
  matchKey: string;
  term: string;
  group: AstrologyStandardGroup;
  meaning: string;
};

const STANDARD_MEANINGS: Record<
  string,
  Omit<StandardGlossaryItem, "matchKey" | "term">
> = {
  เกษตร: {
    group: "มาตรฐานดาว",
    meaning: "ดาวอยู่ในราศีที่ตนเป็นเจ้าเรือน จึงสื่อถึงความมั่นคงและแสดงธรรมชาติของดาวได้ชัด",
  },
  มูลเกษตร: {
    group: "มาตรฐานดาว",
    meaning: "กำลังเกษตรในเชิงฐานราก เน้นความมั่นคงจากพื้นฐานเดิมของดาว",
  },
  มหาอุจจ์: {
    group: "มาตรฐานดาว",
    meaning: "ดาวอยู่ตำแหน่งยกสูง ให้คุณภาพของดาวเด่นและมีกำลังมาก แต่ต้องดูภพและดาวสัมพันธ์ร่วมด้วย",
  },
  อุจจาภิมุข: {
    group: "มาตรฐานดาว",
    meaning: "ตำแหน่งที่มุ่งไปทางอุจจ์ สื่อถึงแนวโน้มที่คุณภาพของดาวได้รับการยกระดับ",
  },
  อุจจาวิลาส: {
    group: "มาตรฐานดาว",
    meaning: "มาตรฐานเสริมฝ่ายให้คุณ สื่อถึงการแสดงพลังของดาวอย่างโดดเด่นหรือสง่างาม",
  },
  ประ: {
    group: "มาตรฐานดาว",
    meaning: "ดาวอยู่ตรงข้ามราศีเกษตรของตน จึงแสดงคุณสมบัติได้ไม่ถนัดและมักต้องอาศัยการปรับตัว",
  },
  นิจ: {
    group: "มาตรฐานดาว",
    meaning: "ดาวอยู่ตรงข้ามตำแหน่งอุจจ์ สื่อถึงกำลังที่ลดลงหรือเรื่องที่ต้องเรียนรู้และชดเชย",
  },
  มหาจักร: {
    group: "มาตรฐานดาว",
    meaning: "สื่อถึงพลังขับเคลื่อนและโอกาสเติบโตผ่านการลงมือ ฝ่าความเปลี่ยนแปลง หรือรับภาระใหญ่",
  },
  จุลจักร: {
    group: "มาตรฐานดาว",
    meaning: "มาตรฐานเสริมที่ให้กำลังในระดับรอง เน้นผลจากความพยายามและการเคลื่อนไหวของตนเอง",
  },
  ราชาโชค: {
    group: "มาตรฐานดาว",
    meaning: "มาตรฐานฝ่ายให้คุณที่สัมพันธ์กับการสนับสนุน เกียรติ หรือโอกาสก้าวหน้า",
  },
  เทวีโชค: {
    group: "มาตรฐานดาว",
    meaning: "มาตรฐานฝ่ายให้คุณที่เน้นความราบรื่น เสน่ห์ ความเอื้อเฟื้อ และความช่วยเหลือ",
  },
  เรือนเกณฑ์: {
    group: "เกณฑ์ประกอบ",
    meaning: "ดาวอยู่ในเรือนมุมสำคัญของดวง คือภพ 1, 4, 7 หรือ 10 ทำให้เรื่องของดาวปรากฏชัดขึ้น",
  },
  ตนุเศษ: {
    group: "เกณฑ์ประกอบ",
    meaning: "ดาวตัวแทนเสริมของเจ้าชะตาจากวิธีคำนวณตนุเศษ ใช้อ่านบุคลิกและแรงขับภายในประกอบลัคนา",
  },
  ตนุลัคน์: {
    group: "เกณฑ์ประกอบ",
    meaning: "ดาวมีความเกี่ยวข้องโดยตรงกับลัคนาหรือภพตนุ จึงเน้นผลต่อบุคลิก ตัวตน และทิศทางชีวิต",
  },
  ตนุเกษตร: {
    group: "เกณฑ์ประกอบ",
    meaning: "ดาวที่เกี่ยวข้องกับภพตนุได้กำลังเกษตร ช่วยเน้นความมั่นคงของตัวตนตามความหมายของดาวนั้น",
  },
  ศูนย์พาหะ: {
    group: "เกณฑ์ประกอบ",
    meaning: "เกณฑ์เฉพาะในระบบคำนวณโหราศาสตร์ไทย ใช้เป็นเงื่อนไขประกอบ ไม่ได้แปลว่าดาวไม่มีพลัง",
  },
  ฆาต: {
    group: "เกณฑ์ประกอบ",
    meaning: "จุดตึงหรือเงื่อนไขที่ควรระวังในการใช้พลังของดาว ไม่ได้หมายถึงเหตุเสียชีวิตโดยตรง",
  },
};

export const DEFAULT_STANDARD_GLOSSARY: StandardGlossaryItem[] = Object.entries(
  STANDARD_MEANINGS,
).map(([key, value]) => ({
  matchKey: key,
  term: key,
  ...value,
}));

function plainPlanetName(raw: string): string {
  if (raw.includes("ลัคนา")) return "ลัคนา";
  return raw.replace(/^[๐-๙0-9.\s]+/, "").trim();
}

function lookupGlossary(
  token: string,
  glossary: StandardGlossaryItem[],
): StandardGlossaryItem | undefined {
  return (
    glossary.find((item) => item.matchKey === token) ??
    glossary.find((item) => item.term === token)
  );
}

export function collectAstrologyStandards(
  rows: MyhoraNatalPlanet[] | null | undefined,
  glossary: StandardGlossaryItem[] = DEFAULT_STANDARD_GLOSSARY,
): AstrologyStandardEntry[] {
  const found = new Map<string, { item: StandardGlossaryItem; planets: Set<string> }>();
  for (const row of rows ?? []) {
    for (const token of row.rerkStandard?.trim().split(/\s+/) ?? []) {
      const item = lookupGlossary(token, glossary);
      if (!item) continue;
      const key = item.matchKey;
      const current = found.get(key) ?? { item, planets: new Set<string>() };
      current.planets.add(plainPlanetName(row.planet));
      found.set(key, current);
    }
  }

  return [...found.values()].map(({ item, planets }) => ({
    matchKey: item.matchKey,
    term: item.term,
    group: item.group,
    meaning: item.meaning,
    planets: [...planets],
  }));
}
