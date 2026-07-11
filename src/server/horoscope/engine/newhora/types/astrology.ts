/**
 * โครงข้อมูลกลาง
 * @see REQUIREMENTS.md
 */

// ——— Input ———

export interface BirthInput {
  day: number
  month: number
  year: number
  /** HH:mm 24h */
  time: string
  country: string
  province: string
  district: string
}

export type BirthFormErrors = Partial<Record<keyof BirthInput, string>>

// ——— ระบบคำนวณ (คงที่ — user เลือกไม่ได้) ———

export interface CalculationSettings {
  calendar: 'suryayat'
  ayanamsa: 'lahiri'
  timeMethod: 'antonathi_samrap_sunrise_local'
  rahuRule: 'eight_signs_aquarius'
  taksaRahuLord: 'mercury_night'
  taksaCountFrom: 'center'
}

// ——— Output: ตาราง ดาว | สถิตรราศี + กราฟราศีจักร ———

export interface PlanetSignRow {
  planet: string
  siderealSign: string
  degreeInSign?: number
  degreeText?: string
}

export interface TaksaSlot {
  taksa: string
  sign: string
  index: number
}

export interface ChartSnapshot {
  lagna: string
  taksa: TaksaSlot[]
}

export type CalculationSource =
  | 'myhora-scrape'
  | 'suryayat-100-reference'
  | 'suryayat-100-year'
  | 'suryayat-cached'
  | 'formula-pipeline'
  | 'ephemeris-fallback'

export interface AstrologyResultMeta {
  birthDisplay: string
  locationDisplay: string
  calculationSource?: CalculationSource
  lagna?: string
}

export interface AstrologyResult {
  input: BirthInput
  calculatedAt: string
  settings: CalculationSettings
  meta: AstrologyResultMeta
  /** 10 ดาวหลัก — คอลัมน์ ดาว | สถิตรราศี */
  planets: PlanetSignRow[]
  /** กราฟราศีจักร (ราศีจักร) */
  chart?: ChartSnapshot
}
