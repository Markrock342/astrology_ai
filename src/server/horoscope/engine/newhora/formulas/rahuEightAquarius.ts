/**
 * ราหู (๘) ราศีกุมภ์ — แปลงสถิตรราศีราหูตามกฎไทย
 * เมื่อราหูอยู่ใน 8 ราศีที่กำหนด ให้เลื่อนตำแหน่งตามชุดกุมภ์
 */

import { SIGNS } from '../data/astrologyConstants'
import type { PlanetSignRow } from '../types/astrology'
import { signIndex } from './siderealPlanets'

const AQUARIUS = 'กุมภ'

/** 8 ราศีคู่กับราหูแบบกุมภ์ (ตัวอย่าง myhora) */
const EIGHT_SIGNS_OFFSET_FROM_AQUARIUS = 8

function pickSign(index: number): string {
  return SIGNS[((index % 12) + 12) % 12] ?? 'เมษ'
}

export function applyRahuEightSignsAquarius(
  planets: PlanetSignRow[],
  lagnaSign: string,
): PlanetSignRow[] {
  const aquariusIdx = SIGNS.indexOf(AQUARIUS)
  if (aquariusIdx < 0) return planets

  const lagnaIdx = signIndex(lagnaSign)
  const offsetBase = (aquariusIdx - (lagnaIdx % EIGHT_SIGNS_OFFSET_FROM_AQUARIUS) + 12) % 12

  return planets.map((row) => {
    if (row.planet !== 'ราหู') return row
    const rawIdx = signIndex(row.siderealSign)
    const adjusted = pickSign(offsetBase + (rawIdx % EIGHT_SIGNS_OFFSET_FROM_AQUARIUS))
    return { ...row, siderealSign: adjusted }
  })
}
