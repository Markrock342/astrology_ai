/**
 * นวางศ์ (D9) / ตรียางศ์ (D3) — สูตรปรชายาจารี (Parashari)
 * ใช้องศาสถิตรลาหิรี + ลัคนาจากเวลาดาราคติ ณ ที่เกิด + ราหู ๘ ราศีกุมภ์
 */

import type { BirthInput, PlanetSignRow } from '../types/astrology'
import type { PlaceCoords } from '../data/placeCoordinates'
import { PLANETS } from '../data/astrologyConstants'
import { birthAstroTime } from './birthMoment'
import { computeSiderealAscendant } from './lagna'
import { computeDrekkanaSign, computeNavamsaSign } from './divisionalCharts'
import { computeSiderealPlanets } from './siderealPlanets'

export interface DivisionalChartRows {
  lagna: string
  planets: PlanetSignRow[]
}

function mapDivisional(
  rows: PlanetSignRow[],
  lagnaSign: string,
  lagnaDeg: number,
  kind: 'navamsa' | 'drekkana',
): DivisionalChartRows {
  const mapSign = kind === 'navamsa' ? computeNavamsaSign : computeDrekkanaSign
  const planets = rows.map((r) => ({
    planet: r.planet,
    siderealSign: mapSign(r.siderealSign, r.degreeInSign ?? 15),
  }))
  const lagna = mapSign(lagnaSign, lagnaDeg)
  return {
    lagna,
    planets,
  }
}

function natalRowsWithDegrees(input: BirthInput, place: PlaceCoords): {
  planets: PlanetSignRow[]
  lagnaSign: string
  lagnaDeg: number
} {
  const time = birthAstroTime(input, place)
  const placements = computeSiderealPlanets(time)
  // Same rising sign as the natal chart (see pipeline.ts fromFormulaPipeline).
  const asc = computeSiderealAscendant(time, place.lat, place.lon)
  const lagna = { sign: asc.sign, degreeInSign: asc.longitude % 30 }
  const planets = PLANETS.map((planet) => {
    const p = placements.get(planet)
    return {
      planet,
      siderealSign: p?.siderealSign ?? '—',
      degreeInSign: p?.degreeInSign,
      degreeText: p?.degreeText,
    }
  })

  return { planets, lagnaSign: lagna.sign, lagnaDeg: lagna.degreeInSign }
}

/** เมื่อดึง myhora สำเร็จแต่ไม่มี embed — ใช้ราศี D1 จาก myhora + องศาลัคนาจากสูตร */
export function computeDivisionalRows(
  input: BirthInput,
  place: PlaceCoords,
  kind: 'navamsa' | 'drekkana',
  d1FromMyhora?: { lagna: string; planets: PlanetSignRow[] },
): DivisionalChartRows {
  const eph = natalRowsWithDegrees(input, place)
  if (!d1FromMyhora) {
    return mapDivisional(eph.planets, eph.lagnaSign, eph.lagnaDeg, kind)
  }

  const lagna = d1FromMyhora.lagna
  const lagnaDeg = eph.lagnaSign === lagna ? eph.lagnaDeg : 15
  const planets = d1FromMyhora.planets.map((p) => ({
    planet: p.planet,
    siderealSign: p.siderealSign,
    degreeInSign: p.degreeInSign ?? 15,
  }))
  return mapDivisional(planets, lagna, lagnaDeg, kind)
}
