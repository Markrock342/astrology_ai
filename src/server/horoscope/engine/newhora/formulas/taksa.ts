/**
 * ทักษา 9 ช่อง — นับตากลาง จากลัคนา
 * ทักษา ราหู = พุธกลางคืน (ใช้กำหนดราหูใน rahuEightAquarius)
 */

import { SIGNS } from '../data/astrologyConstants'

export const TAKSA_NAMES = [
  'กาลกุล',
  'ทราย',
  'อุตตร',
  'วิชาคุณ',
  'ปัญหา',
  'กาลกินี',
  'เทวี',
  'โชคลาภ',
  'ศรี',
] as const

export interface TaksaSlot {
  taksa: string
  sign: string
  index: number
}

/** ทักษาช่องกลาง = ลัคนา แล้วเรียงตามลำดับ 9 ช่อง */
export function computeTaksaFromLagna(lagnaSign: string): TaksaSlot[] {
  const lagnaIdx = SIGNS.indexOf(lagnaSign as (typeof SIGNS)[number])
  const base = lagnaIdx >= 0 ? lagnaIdx : 0

  return TAKSA_NAMES.map((taksa, i) => {
    const signIdx = (base + i) % 12
    return {
      taksa,
      sign: SIGNS[signIdx] ?? 'เมษ',
      index: i,
    }
  })
}

export function isNightBirth(time: string): boolean {
  const [h] = time.split(':').map(Number)
  const hour = h ?? 0
  return hour < 6 || hour >= 18
}
