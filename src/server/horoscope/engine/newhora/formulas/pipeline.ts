/**
 * คำนวณครบวงจร: ปฏิทินร้อยปี → แคช (async) → สูตร (อันโตนาที + ลาหิรี + ราหู 8 + ทักษา)
 */

import { Body, Observer, SearchRiseSet } from 'astronomy-engine'
import type { BirthInput, PlanetSignRow } from '../types/astrology'
import type { PlaceCoords } from '../data/placeCoordinates'
import { PLANETS } from '../data/astrologyConstants'
import { birthAstroTime } from './birthMoment'
import { computeSiderealPlanets } from './siderealPlanets'
import { computeAntonathiSamrapLagna } from './antonathiSamrap'
import { applyRahuEightSignsAquarius } from './rahuEightAquarius'
import { computeTaksaFromLagna, type TaksaSlot } from './taksa'
import { birthLocalMinutes, localMinutesFromMidnight, sunriseLocalMinutes } from './sunrise'
import { lookupSuryayatSync, lookupLagnaSync } from './suryayat/lookup'

export type PipelineSource =
  | 'suryayat-100-reference'
  | 'suryayat-100-year'
  | 'suryayat-cached'
  | 'formula-pipeline'

export interface PipelineResult {
  planets: PlanetSignRow[]
  lagna: string
  taksa: TaksaSlot[]
  source: PipelineSource
}

function signsToRows(signs: Record<string, { sign: string; degreeInSign?: number; degreeText?: string } | string>): PlanetSignRow[] {
  return PLANETS.map((planet) => {
    const v = signs[planet]
    if (typeof v === 'string') {
      return { planet, siderealSign: v }
    }
    return {
      planet,
      siderealSign: v?.sign ?? '—',
      degreeInSign: v?.degreeInSign,
      degreeText: v?.degreeText,
    }
  })
}

function fromFormulaPipeline(input: BirthInput, place: PlaceCoords): {
  planets: PlanetSignRow[]
  lagna: string
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
    /* ใช้ค่าโดยประมาณ 06:00 */
  }

  const lagnaResult = computeAntonathiSamrapLagna(riseTime, birthMin, sunriseMin)

  const planets = PLANETS.map((planet) => {
    const p = placements.get(planet)
    return {
      planet,
      siderealSign: p?.siderealSign ?? '—',
      degreeInSign: p?.degreeInSign,
      degreeText: p?.degreeText,
    }
  })

  return { planets, lagna: lagnaResult.sign }
}

export function computeFullChartSync(
  input: BirthInput,
  place: PlaceCoords,
): PipelineResult {
  const lookup = lookupSuryayatSync(input, place)
  if (lookup) {
    const lagna = lookupLagnaSync(input, place) ?? 'เมษ'
    return {
      planets: signsToRows(lookup.signs),
      lagna,
      taksa: computeTaksaFromLagna(lagna),
      source:
        lookup.source === 'reference' ? 'suryayat-100-reference' : 'suryayat-100-year',
    }
  }

  const { planets: rawPlanets, lagna: rawLagna } = fromFormulaPipeline(input, place)
  const planets = applyRahuEightSignsAquarius(rawPlanets, rawLagna)

  return {
    planets,
    lagna: rawLagna,
    taksa: computeTaksaFromLagna(rawLagna),
    source: 'formula-pipeline',
  }
}
