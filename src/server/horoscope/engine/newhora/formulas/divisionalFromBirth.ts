/**
 * นวางศ์ (D9) / ตรียางศ์ (D3) — สูตรปรชายาจารี (Parashari)
 * ใช้องศาสถิตรลาหิรี + ลัคนาอันโตนาทีสมผุสอาทิตย์อุทัย + ราหู ๘ ราศีกุมภ์
 */

import { Body, Observer, SearchRiseSet } from 'astronomy-engine'
import type { BirthInput, PlanetSignRow } from '../types/astrology'
import type { PlaceCoords } from '../data/placeCoordinates'
import { PLANETS } from '../data/astrologyConstants'
import { birthAstroTime } from './birthMoment'
import { computeAntonathiSamrapLagna } from './antonathiSamrap'
import { computeDrekkanaSign, computeNavamsaSign } from './divisionalCharts'
import { applyRahuEightSignsAquarius } from './rahuEightAquarius'
import { computeSiderealPlanets } from './siderealPlanets'
import { birthLocalMinutes, localMinutesFromMidnight, sunriseLocalMinutes } from './sunrise'

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
    planets: applyRahuEightSignsAquarius(planets, lagna),
  }
}

function natalRowsWithDegrees(input: BirthInput, place: PlaceCoords): {
  planets: PlanetSignRow[]
  lagnaSign: string
  lagnaDeg: number
} {
  const time = birthAstroTime(input, place)
  const placements = computeSiderealPlanets(time)
  const birthMin = birthLocalMinutes(input.time)

  let riseTime = time
  let sunriseMin = sunriseLocalMinutes(time, place) ?? 6 * 60
  try {
    const observer = new Observer(place.lat, place.lon, 0)
    const rise = SearchRiseSet(Body.Sun, observer, 1, time, 1)
    if (rise) {
      riseTime = rise
      sunriseMin = localMinutesFromMidnight(rise, place.utcOffsetMinutes)
    }
  } catch {
    /* ค่าโดยประมาณ 06:00 */
  }

  const lagna = computeAntonathiSamrapLagna(riseTime, birthMin, sunriseMin)
  const planets = PLANETS.map((planet) => {
    const p = placements.get(planet)
    return {
      planet,
      siderealSign: p?.siderealSign ?? '—',
      degreeInSign: p?.degreeInSign,
      degreeText: p?.degreeText,
    }
  })

  const adjusted = applyRahuEightSignsAquarius(planets, lagna.sign)
  return { planets: adjusted, lagnaSign: lagna.sign, lagnaDeg: lagna.degreeInSign }
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
