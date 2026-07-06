import type { CalculationSettings } from '../types/astrology'

/**
 * ระบบคำนวณคงที่ — ตรงกับที่เลือกใน myhora (ภาพอ้างอิง) แต่ user ไม่ต้องเลือกเอง
 * ไม่ copy สูตร — แค่ config ชื่อเดียวกัน
 *
 * myhora panel          →  NewHora
 * ─────────────────────────────────────────
 * สุริยยาตร์            →  calendar
 * ลาหิรี                →  ayanamsa (ใช้คู่สุริยยาตร์ตามที่กำหนด)
 * ลัคนา อันโตนาทีฯ      →  timeMethod
 * ดาวเกษตร ราหู(๘)กุมภ์ →  rahuRule
 * ทักษาราหู=พุธกลางคืน  →  taksaRahuLord
 * ทักษานับตากลาง       →  taksaCountFrom
 */
export const CALCULATION_SETTINGS: CalculationSettings = {
  calendar: 'suryayat',
  ayanamsa: 'lahiri',
  timeMethod: 'antonathi_samrap_sunrise_local',
  rahuRule: 'eight_signs_aquarius',
  taksaRahuLord: 'mercury_night',
  taksaCountFrom: 'center',
}

/** ป้ายแสดง — ตรงข้อความที่ user กำหนด */
export const CALCULATION_SETTINGS_LABELS: { key: keyof CalculationSettings; label: string }[] =
  [
    { key: 'calendar', label: 'สุริยยาตร์' },
    { key: 'ayanamsa', label: 'ลาหิรี' },
    { key: 'timeMethod', label: 'อันโตนาทีสามัญ สมผุสอาทิตย์อุทัย ปรับเวลาท้องถิ่น' },
    { key: 'rahuRule', label: 'ราหู ๘ ราศีกุมภ์' },
    { key: 'taksaRahuLord', label: 'ทักษา ราหู = พุธกลางคืน' },
    { key: 'taksaCountFrom', label: 'ทักษานับตากลาง' },
  ]

/** สิ่งใน myhora ที่ไม่เอา — ห้ามเพิ่มใน UI จนกว่า user สั่ง */
export const MYHORA_OPTIONS_EXCLUDED = [
  'นิรายนะวิธี (ปฏิทิน)',
  'นับวันเปลี่ยน / เวลาดวงอาทิตย์ขึ้น',
  'ตรีวัย (ตนุเศษ ฯลฯ)',
  'ชันษาจร / กาลจักร / พารณสี',
  'มุมโยค ตรีโกณ',
  'ตารางผลหลายคอลัมน์ (เรือน องศา เกษตร ทักษาแยก ฯลฯ)',
] as const
