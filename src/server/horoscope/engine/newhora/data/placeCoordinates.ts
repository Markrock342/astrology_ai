/** พิกัดสถานที่เกิด — อ้างอิง myhora (เช่น พระนคร 13.752555, 100.494066) */

export interface PlaceCoords {
  lat: number
  lon: number
  /** นาทีจาก UTC (ไทย = +420) */
  utcOffsetMinutes: number
}

const THAILAND_UTC = 420

/** จังหวัด → อำเภอ/เขต → พิกัด */
const THAI_DISTRICTS: Record<string, Record<string, PlaceCoords>> = {
  กรุงเทพมหานคร: {
    พระนคร: { lat: 13.752555, lon: 100.494066, utcOffsetMinutes: THAILAND_UTC },
    ดุสิต: { lat: 13.772585, lon: 100.519032, utcOffsetMinutes: THAILAND_UTC },
    บางรัก: { lat: 13.729852, lon: 100.526504, utcOffsetMinutes: THAILAND_UTC },
    ปทุมวัน: { lat: 13.746253, lon: 100.534119, utcOffsetMinutes: THAILAND_UTC },
    วัฒนา: { lat: 13.737364, lon: 100.579832, utcOffsetMinutes: THAILAND_UTC },
    คลองเตย: { lat: 13.722684, lon: 100.559063, utcOffsetMinutes: THAILAND_UTC },
    สาทร: { lat: 13.718334, lon: 100.529097, utcOffsetMinutes: THAILAND_UTC },
    บางแค: { lat: 13.6918, lon: 100.407, utcOffsetMinutes: THAILAND_UTC },
    _default: { lat: 13.756331, lon: 100.501762, utcOffsetMinutes: THAILAND_UTC },
  },
  เชียงใหม่: {
    เมืองเชียงใหม่: { lat: 18.790384, lon: 98.98468, utcOffsetMinutes: THAILAND_UTC },
    _default: { lat: 18.788343, lon: 98.985352, utcOffsetMinutes: THAILAND_UTC },
  },
  ขอนแก่น: {
    เมืองขอนแก่น: { lat: 16.441935, lon: 102.835992, utcOffsetMinutes: THAILAND_UTC },
    _default: { lat: 16.432193, lon: 102.823621, utcOffsetMinutes: THAILAND_UTC },
  },
}

const THAI_PROVINCE_DEFAULTS: Record<string, PlaceCoords> = {
  กรุงเทพมหานคร: { lat: 13.756331, lon: 100.501762, utcOffsetMinutes: THAILAND_UTC },
  เชียงใหม่: { lat: 18.788343, lon: 98.985352, utcOffsetMinutes: THAILAND_UTC },
  ขอนแก่น: { lat: 16.432193, lon: 102.823621, utcOffsetMinutes: THAILAND_UTC },
  นครราชสีมา: { lat: 14.9799, lon: 102.09777, utcOffsetMinutes: THAILAND_UTC },
  ชลบุรี: { lat: 13.361143, lon: 100.984673, utcOffsetMinutes: THAILAND_UTC },
}

const DEFAULT_THAILAND: PlaceCoords = {
  lat: 13.756331,
  lon: 100.501762,
  utcOffsetMinutes: THAILAND_UTC,
}

export function resolvePlaceCoords(
  country: string,
  province: string,
  district: string,
): PlaceCoords {
  if (country === 'ไทย' || country.trim() === '') {
    const prov = province.trim()
    const dist = district.trim()
    const byDistrict = THAI_DISTRICTS[prov]
    if (byDistrict) {
      if (dist && byDistrict[dist]) return byDistrict[dist]
      if (byDistrict._default) return byDistrict._default
    }
    if (prov && THAI_PROVINCE_DEFAULTS[prov]) return THAI_PROVINCE_DEFAULTS[prov]
    return DEFAULT_THAILAND
  }
  return DEFAULT_THAILAND
}
