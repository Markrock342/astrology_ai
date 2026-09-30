/**
 * อันโตนาทีสามัญ — นาทีที่แต่ละราศีใช้ขึ้นขอบฟ้า (ลำดับเมษ→มีน รวม 1440 นาที/วัน)
 *
 * The table myhora's "ลัคนาอันโตนาทีสามัญ สมผุสอาทิตย์อุทัย" dial uses, and
 * the classical one (4ZSuriya, duangmongkoncheewit). It replaced an unsourced
 * table (197, 215, 208…) that put lagnas 7–16° away from myhora.
 */

import { SIGNS } from './astrologyConstants'

export const ANTONATHI_SAMAN_MINUTES: readonly number[] = [
  120, 96, 72, 120, 144, 168, 168, 144, 120, 72, 96, 120,
] as const

/** นาทีนาฬิกาที่ใช้ข้าม 30° ของแต่ละราศี */
export function antonathiClockMinutesForSign(signIndex: number): number {
  return ANTONATHI_SAMAN_MINUTES[((signIndex % 12) + 12) % 12]!
}

export function signIndexFromName(sign: string): number {
  const i = SIGNS.indexOf(sign as (typeof SIGNS)[number])
  return i >= 0 ? i : 0
}

export function signNameFromIndex(index: number): string {
  return SIGNS[((index % 12) + 12) % 12] ?? 'เมษ'
}
