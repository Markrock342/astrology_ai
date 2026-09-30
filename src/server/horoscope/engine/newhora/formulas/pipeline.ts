/**
 * คำนวณครบวงจร: ปฏิทินร้อยปี → แคช (async) → สูตร (ลัคนาจากเวลาดาราคติ + ลาหิรี + ราหู 8 + ทักษา)
 */

import type { BirthInput, PlanetSignRow } from '../types/astrology'
import type { PlaceCoords } from '../data/placeCoordinates'
import { PLANETS } from '../data/astrologyConstants'
import { birthAstroTime } from './birthMoment'
import { computeSiderealPlanets } from './siderealPlanets'
import { computeSiderealAscendant } from './lagna'
import { computeTaksaFromBirth, type TaksaSlot } from './taksa'
import { lookupSuryayatSync, lookupLagnaSync } from './suryayat/lookup'

export type PipelineSource =
  | 'suryayat-100-reference'
  | 'suryayat-100-year'
  | 'suryayat-cached'
  | 'formula-pipeline'

export interface PipelineResult {
  planets: PlanetSignRow[]
  lagna: string
  lagnaDegreeInSign?: number
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
  lagnaDegreeInSign: number
} {
  const time = birthAstroTime(input, place)
  const placements = computeSiderealPlanets(time)

  // The rising sign, computed from sidereal time at the birthplace (Lahiri).
  // It replaced an antonathi walk from sunrise whose per-sign table had no
  // source: it strayed up to 5° from the sky, so a birth near a sign edge
  // could land in the wrong sign — 18 Nov 2001 02:08 โคราช came out สิงห์
  // where myhora has กันย์. This matches every myhora-verified chart we hold.
  const lagnaResult = computeSiderealAscendant(time, place.lat, place.lon)
  const lagnaDegreeInSign = lagnaResult.longitude % 30

  const planets = PLANETS.map((planet) => {
    const p = placements.get(planet)
    return {
      planet,
      siderealSign: p?.siderealSign ?? '—',
      degreeInSign: p?.degreeInSign,
      degreeText: p?.degreeText,
    }
  })

  return { planets, lagna: lagnaResult.sign, lagnaDegreeInSign }
}

/**
 * Keep the Suriyayat sign as the authority. Formula degrees are attached only
 * when the independently calculated sign agrees, so an apparent degree can
 * never contradict the sign shown to the user.
 */
export function mergeVerifiedFormulaDegrees(
  suryayatRows: PlanetSignRow[],
  formulaRows: PlanetSignRow[],
): PlanetSignRow[] {
  return suryayatRows.map((row) => {
    const formula = formulaRows.find((candidate) => candidate.planet === row.planet)
    if (!formula || formula.siderealSign !== row.siderealSign) return row
    return {
      ...row,
      degreeInSign: formula.degreeInSign,
      degreeText: formula.degreeText,
    }
  })
}

export function computeFullChartSync(
  input: BirthInput,
  place: PlaceCoords,
): PipelineResult {
  const lookup = lookupSuryayatSync(input, place)
  if (lookup) {
    const suryayatRows = signsToRows(lookup.signs)
    const formula = fromFormulaPipeline(input, place)
    // The 100-year table carries planet signs for most days but a lagna for
    // few of them. The fallback here used to be a hard-coded 'เมษ', so every
    // birth on such a day got an Aries ascendant whatever the time — and every
    // house in the reading was counted from it. The antonathi formula computes
    // the real one from sunrise and birth time; use it.
    const lagna = lookupLagnaSync(input, place) ?? formula.lagna
    const verifiedFormulaRows = formula.planets
    return {
      planets: mergeVerifiedFormulaDegrees(suryayatRows, verifiedFormulaRows),
      lagna,
      lagnaDegreeInSign:
        formula.lagna === lagna ? formula.lagnaDegreeInSign : undefined,
      taksa: computeTaksaFromBirth(input),
      source:
        lookup.source === 'reference' ? 'suryayat-100-reference' : 'suryayat-100-year',
    }
  }

  const { planets: rawPlanets, lagna: rawLagna, lagnaDegreeInSign } = fromFormulaPipeline(input, place)
  const planets = rawPlanets

  return {
    planets,
    lagna: rawLagna,
    lagnaDegreeInSign,
    taksa: computeTaksaFromBirth(input),
    source: 'formula-pipeline',
  }
}
