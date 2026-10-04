/**
 * Birthplaces outside Thailand. The birth form takes free text for them, and
 * the engine used to compute every one of them at Bangkok's coordinates and
 * UTC+7: a Yangon birth (UTC+6:30) came out half an hour off, a Los Angeles
 * birth fourteen hours off. Each place carries its IANA zone, so the offset —
 * daylight saving included — is the one in force on the birth date.
 */

export type ForeignPlace = {
  /** Lower-case English and Thai names the free text is matched against. */
  names: string[];
  lat: number;
  lon: number;
  tz: string;
};

const place = (names: string[], lat: number, lon: number, tz: string): ForeignPlace => ({
  names,
  lat,
  lon,
  tz,
});

const LAOS = "Asia/Vientiane";
const CAMBODIA = "Asia/Phnom_Penh";
const MYANMAR = "Asia/Yangon";

/** The three neighbours the form lists by name fall back to their capital. */
export const NEIGHBOUR_CAPITAL: Record<string, ForeignPlace> = {
  ลาว: place(["vientiane", "เวียงจันทน์", "เวียงจันทร์"], 17.9757, 102.6331, LAOS),
  กัมพูชา: place(["phnom penh", "พนมเปญ"], 11.5564, 104.9282, CAMBODIA),
  เมียนมา: place(["yangon", "rangoon", "ย่างกุ้ง"], 16.8409, 96.1735, MYANMAR),
};

export const FOREIGN_PLACES: ForeignPlace[] = [
  ...Object.values(NEIGHBOUR_CAPITAL),
  place(["luang prabang", "หลวงพระบาง"], 19.8856, 102.1347, LAOS),
  place(["pakse", "ปากเซ"], 15.1202, 105.799, LAOS),
  place(["savannakhet", "สะหวันนะเขต"], 16.5563, 104.7522, LAOS),
  place(["thakhek", "ท่าแขก"], 17.4103, 104.8307, LAOS),
  place(["siem reap", "เสียมราฐ", "เสียมเรียบ"], 13.3633, 103.8564, CAMBODIA),
  place(["battambang", "พระตะบอง"], 13.0957, 103.2022, CAMBODIA),
  place(["sihanoukville", "สีหนุวิลล์", "กำปงโสม"], 10.6093, 103.5296, CAMBODIA),
  place(["poipet", "ปอยเปต"], 13.6593, 102.5627, CAMBODIA),
  place(["mandalay", "มัณฑะเลย์"], 21.9588, 96.0891, MYANMAR),
  place(["naypyidaw", "nay pyi taw", "เนปิดอว์"], 19.7633, 96.0785, MYANMAR),
  place(["mawlamyine", "moulmein", "เมาะลำเลิง"], 16.4905, 97.6283, MYANMAR),
  place(["myawaddy", "เมียวดี"], 16.6889, 98.5089, MYANMAR),
  place(["tachileik", "ท่าขี้เหล็ก"], 20.4475, 99.8808, MYANMAR),
  place(["dawei", "tavoy", "ทวาย"], 14.0823, 98.1915, MYANMAR),

  place(["los angeles", "california", "ลอสแอนเจลิส", "แอลเอ", "แคลิฟอร์เนีย"], 34.0522, -118.2437, "America/Los_Angeles"),
  place(["san francisco", "ซานฟรานซิสโก"], 37.7749, -122.4194, "America/Los_Angeles"),
  place(["las vegas", "nevada", "ลาสเวกัส"], 36.1699, -115.1398, "America/Los_Angeles"),
  place(["seattle", "ซีแอตเทิล"], 47.6062, -122.3321, "America/Los_Angeles"),
  place(["new york", "นิวยอร์ก"], 40.7128, -74.006, "America/New_York"),
  place(["boston", "บอสตัน"], 42.3601, -71.0589, "America/New_York"),
  place(["washington dc", "วอชิงตันดีซี"], 38.9072, -77.0369, "America/New_York"),
  place(["miami", "florida", "ไมอามี", "ฟลอริดา"], 25.7617, -80.1918, "America/New_York"),
  place(["chicago", "illinois", "ชิคาโก"], 41.8781, -87.6298, "America/Chicago"),
  place(["houston", "texas", "ฮิวสตัน", "เท็กซัส"], 29.7604, -95.3698, "America/Chicago"),
  place(["honolulu", "hawaii", "ฮาวาย"], 21.3069, -157.8583, "Pacific/Honolulu"),
  place(["usa", "united states", "america", "อเมริกา", "สหรัฐ"], 40.7128, -74.006, "America/New_York"),
  place(["toronto", "canada", "โทรอนโต", "แคนาดา"], 43.6532, -79.3832, "America/Toronto"),
  place(["vancouver", "แวนคูเวอร์"], 49.2827, -123.1207, "America/Vancouver"),

  place(["london", "england", "united kingdom", "ลอนดอน", "อังกฤษ"], 51.5074, -0.1278, "Europe/London"),
  place(["paris", "france", "ปารีส", "ฝรั่งเศส"], 48.8566, 2.3522, "Europe/Paris"),
  place(["berlin", "germany", "เบอร์ลิน", "เยอรมนี", "เยอรมัน"], 52.52, 13.405, "Europe/Berlin"),
  place(["munich", "münchen", "มิวนิก"], 48.1351, 11.582, "Europe/Berlin"),
  place(["frankfurt", "แฟรงก์เฟิร์ต"], 50.1109, 8.6821, "Europe/Berlin"),
  place(["amsterdam", "netherlands", "อัมสเตอร์ดัม", "เนเธอร์แลนด์"], 52.3676, 4.9041, "Europe/Amsterdam"),
  place(["zurich", "switzerland", "ซูริก", "สวิตเซอร์แลนด์"], 47.3769, 8.5417, "Europe/Zurich"),
  place(["rome", "italy", "โรม", "อิตาลี"], 41.9028, 12.4964, "Europe/Rome"),
  place(["stockholm", "sweden", "สตอกโฮล์ม", "สวีเดน"], 59.3293, 18.0686, "Europe/Stockholm"),
  place(["oslo", "norway", "ออสโล", "นอร์เวย์"], 59.9139, 10.7522, "Europe/Oslo"),
  place(["copenhagen", "denmark", "โคเปนเฮเกน", "เดนมาร์ก"], 55.6761, 12.5683, "Europe/Copenhagen"),
  place(["helsinki", "finland", "เฮลซิงกิ", "ฟินแลนด์"], 60.1699, 24.9384, "Europe/Helsinki"),

  place(["tokyo", "japan", "โตเกียว", "ญี่ปุ่น"], 35.6762, 139.6503, "Asia/Tokyo"),
  place(["osaka", "โอซาก้า", "โอซากา"], 34.6937, 135.5023, "Asia/Tokyo"),
  place(["seoul", "korea", "โซล", "เกาหลี"], 37.5665, 126.978, "Asia/Seoul"),
  place(["beijing", "china", "ปักกิ่ง", "จีน"], 39.9042, 116.4074, "Asia/Shanghai"),
  place(["shanghai", "เซี่ยงไฮ้"], 31.2304, 121.4737, "Asia/Shanghai"),
  place(["kunming", "yunnan", "คุนหมิง", "ยูนนาน"], 25.0389, 102.7183, "Asia/Shanghai"),
  place(["guangzhou", "กวางโจว"], 23.1291, 113.2644, "Asia/Shanghai"),
  place(["hong kong", "ฮ่องกง"], 22.3193, 114.1694, "Asia/Hong_Kong"),
  place(["taipei", "taiwan", "ไทเป", "ไต้หวัน"], 25.033, 121.5654, "Asia/Taipei"),
  place(["singapore", "สิงคโปร์"], 1.3521, 103.8198, "Asia/Singapore"),
  place(["kuala lumpur", "malaysia", "กัวลาลัมเปอร์", "มาเลเซีย"], 3.139, 101.6869, "Asia/Kuala_Lumpur"),
  place(["penang", "ปีนัง"], 5.4141, 100.3288, "Asia/Kuala_Lumpur"),
  place(["hanoi", "vietnam", "ฮานอย", "เวียดนาม"], 21.0278, 105.8342, "Asia/Ho_Chi_Minh"),
  place(["ho chi minh", "saigon", "โฮจิมินห์", "ไซ่ง่อน"], 10.8231, 106.6297, "Asia/Ho_Chi_Minh"),
  place(["jakarta", "indonesia", "จาการ์ตา", "อินโดนีเซีย"], -6.2088, 106.8456, "Asia/Jakarta"),
  place(["bali", "denpasar", "บาหลี"], -8.65, 115.2167, "Asia/Makassar"),
  place(["manila", "philippines", "มะนิลา", "ฟิลิปปินส์"], 14.5995, 120.9842, "Asia/Manila"),
  place(["delhi", "india", "เดลี", "อินเดีย"], 28.6139, 77.209, "Asia/Kolkata"),
  place(["mumbai", "bombay", "มุมไบ"], 19.076, 72.8777, "Asia/Kolkata"),
  place(["dhaka", "bangladesh", "ธากา", "บังกลาเทศ"], 23.8103, 90.4125, "Asia/Dhaka"),
  place(["kathmandu", "nepal", "กาฐมาณฑุ", "เนปาล"], 27.7172, 85.324, "Asia/Kathmandu"),
  place(["colombo", "sri lanka", "โคลัมโบ", "ศรีลังกา"], 6.9271, 79.8612, "Asia/Colombo"),
  place(["dubai", "united arab emirates", "ดูไบ"], 25.2048, 55.2708, "Asia/Dubai"),
  place(["riyadh", "saudi", "ริยาด", "ซาอุ"], 24.7136, 46.6753, "Asia/Riyadh"),
  place(["tel aviv", "israel", "เทลอาวีฟ", "อิสราเอล"], 32.0853, 34.7818, "Asia/Jerusalem"),

  place(["sydney", "australia", "ซิดนีย์", "ออสเตรเลีย"], -33.8688, 151.2093, "Australia/Sydney"),
  place(["melbourne", "เมลเบิร์น"], -37.8136, 144.9631, "Australia/Melbourne"),
  place(["brisbane", "บริสเบน"], -27.4698, 153.0251, "Australia/Brisbane"),
  place(["perth", "เพิร์ท"], -31.9505, 115.8605, "Australia/Perth"),
  place(["auckland", "new zealand", "โอ๊คแลนด์", "นิวซีแลนด์"], -36.8485, 174.7633, "Pacific/Auckland"),
];

function squash(text: string): string {
  return text.toLowerCase().replace(/[\s.,'’()\-_/]+/g, "");
}

const INDEX = FOREIGN_PLACES.flatMap((p) => p.names.map((n) => ({ key: squash(n), place: p })));

/**
 * The place named by the free text: the city field first, then the state /
 * province, then the country; the longest name wins ("new york" over "york").
 * Laos, Cambodia and Myanmar fall back to their capital. Null when nothing
 * is recognised — the caller must not guess.
 */
export function resolveForeignPlace(
  country: string,
  province: string,
  district: string,
): ForeignPlace | null {
  for (const field of [district, province, country]) {
    const text = squash(field ?? "");
    if (!text) continue;
    let best: { key: string; place: ForeignPlace } | null = null;
    for (const entry of INDEX) {
      if (text.includes(entry.key) && (!best || entry.key.length > best.key.length)) best = entry;
    }
    if (best) return best.place;
  }
  return NEIGHBOUR_CAPITAL[country.trim()] ?? null;
}

/** Minutes east of UTC in `tz` at that local wall-clock time (DST included). */
export function utcOffsetMinutesAt(
  tz: string,
  year: number,
  month: number,
  day: number,
  hour = 12,
  minute = 0,
): number {
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  });
  const offsetAt = (utcMs: number) => {
    const p = Object.fromEntries(fmt.formatToParts(new Date(utcMs)).map((x) => [x.type, x.value]));
    const local = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute));
    return Math.round((local - utcMs) / 60_000);
  };
  // Guess the instant with the offset at the wall time, then correct once for
  // a DST change between the two.
  const first = offsetAt(wall);
  return offsetAt(wall - first * 60_000);
}
