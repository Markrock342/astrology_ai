/**
 * อันโตนาทีสามัญ — นาทีต่อราศี (รวม 2450 → สเกลเป็น 1440 นาทีจริง/วัน)
 * อ้างอิงตำราโหรไทยทั่วไป / จานหมุนลัคนาสำเร็จ myhora
 */

import { SIGNS } from './astrologyConstants'

/** นาทีอันโตนาทีดั้งเดิมต่อราศี (ลำดับเมษ→มีน) */
export const ANTONATHI_RAW_MINUTES: readonly number[] = [
  197, 215, 208, 213, 219, 198, 197, 207, 209, 209, 198, 180,
] as const

const ANTONATHI_TOTAL = ANTONATHI_RAW_MINUTES.reduce((a, b) => a + b, 0)

/** นาทีนาฬิกาจริงที่ใช้ข้าม 30° ของแต่ละราศี (รวม 1440 นาที/วัน) */
export function antonathiClockMinutesForSign(signIndex: number): number {
  const raw = ANTONATHI_RAW_MINUTES[signIndex % 12] ?? 120
  return (raw / ANTONATHI_TOTAL) * 1440
}

export function signIndexFromName(sign: string): number {
  const i = SIGNS.indexOf(sign as (typeof SIGNS)[number])
  return i >= 0 ? i : 0
}

export function signNameFromIndex(index: number): string {
  return SIGNS[((index % 12) + 12) % 12] ?? 'เมษ'
}
