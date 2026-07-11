/** ปฏิทินร้อยปี สุริยยาตร์ — โครงข้อมูล lookup */

import type { PlanetSignRow } from '../../types/astrology'

/** สถิตรราศี 10 ดาว (ไม่รวมลัคนาใน output UI) */
export type SuryayatPlanetSigns = Record<string, string>

/** ชุดอ้างอิงใน referenceCharts.ts */
export interface SuryayatReferenceEntry {
  planets: SuryayatPlanetSigns
  lagna?: string
}

/** หนึ่งวันในปฏิทิน — ขยายเป็นรายชั่วโมงได้ภายหลัง */
export interface SuryayatDayEntry {
  /** สถิตรราศีต่อดาว ตามปฏิทินสุริยยาตร์ */
  planets: SuryayatPlanetSigns
  /** ใช้ภายใน / debug */
  lagna?: string
}

/** ไฟล์ต่อปี พ.ศ. เช่น years/2549.json */
export interface SuryayatYearFile {
  beYear: number
  source?: string
  days: Record<string, SuryayatDayEntry>
}

export function toPlanetSignRows(signs: SuryayatPlanetSigns): PlanetSignRow[] {
  return Object.entries(signs).map(([planet, siderealSign]) => ({
    planet,
    siderealSign,
  }))
}
