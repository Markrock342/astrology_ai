/**
 * คำนวณครบวงจร: ปฏิทินร้อยปี → แคช (async) → สูตร (ลัคนาอันโตนาทีสามัญ + ลาหิรี + ทักษา)
 */

import { MakeTime } from 'astronomy-engine'
import type { BirthInput, PlanetSignRow } from '../types/astrology'
import type { PlaceCoords } from '../data/placeCoordinates'
import { PLANETS } from '../data/astrologyConstants'
import { birthAstroTime } from './birthMoment'
import {
  computeSiderealPlanets,
  formatDegreeInSign,
  signFromSiderealLongitude,
} from './siderealPlanets'
import {
  computeAntonathiSamrapLagna,
  suriyayatMoonLongitude,
  suriyayatSunLongitude,
} from './antonathiSamrap'
import { computeTaksaFromBirth, type TaksaSlot } from './taksa'
import { lookupSuryayatSync, lookupLagnaSync } from './suryayat/lookup'
import { hasSuriyayatPlanetFit, suriyayatPlanetLongitude } from './suriyayatPlanets'

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

  // ลัคนาอันโตนาทีสามัญ สมผุสอาทิตย์อุทัย — myhora's method; see antonathiSamrap.ts.
  const sun = placements.get('อาทิตย์')
  const lagnaResult = computeAntonathiSamrapLagna(time, place.lat, place.lon, sun?.siderealLongitude ?? 0)
  const lagnaDegreeInSign = lagnaResult.degreeInSign

  // Sun and Moon moved onto the Suriyayat ephemeris (myhora's); the rest
  // stay Lahiri. The Moon differs by up to 4° — enough to put it in the wrong
  // sign for hours around each sign change.
  const toSuriyayat: Record<string, (lon: number, ut: number) => number> = {
    'อาทิตย์': suriyayatSunLongitude,
    'จันทร์': suriyayatMoonLongitude,
  }
  const planets = PLANETS.map((planet) => {
    const p = placements.get(planet)
    const fix = toSuriyayat[planet]
    if (p && fix) {
      const { sign, degreeInSign } = signFromSiderealLongitude(fix(p.siderealLongitude, time.ut))
      return { planet, siderealSign: sign, degreeInSign, degreeText: formatDegreeInSign(degreeInSign) }
    }
    // Mercury … Saturn: the fitted Suriyayat correction (suriyayatPlanets.ts).
    if (p && sun && hasSuriyayatPlanetFit(planet)) {
      const lon = suriyayatPlanetLongitude(planet, p.siderealLongitude, sun.siderealLongitude, time.ut)
      const { sign, degreeInSign } = signFromSiderealLongitude(lon)
      return { planet, siderealSign: sign, degreeInSign, degreeText: formatDegreeInSign(degreeInSign) }
    }
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
    // กุมภ์ (table) and กุมภ (formula) are the same sign.
    const bare = (sign: string) => sign.replace(/์/g, '')
    if (!formula || bare(formula.siderealSign) !== bare(row.siderealSign)) return row
    return {
      ...row,
      degreeInSign: formula.degreeInSign,
      degreeText: formula.degreeText,
    }
  })
}

/**
 * The 100-year table gives each day's signs at its END (24:00). A planet that
 * changed sign during the birth day — the Moon does every two days or so —
 * carries its new sign for a birth before the change. Where the previous day's
 * row differs, the position computed for the birth moment decides the side;
 * found by checking 20 production charts against myhora (Moon กันย์ at 09:16
 * on 10 Aug 2006 was read as ตุลย์).
 */
/**
 * The table's rows sit at 24:00 UTC+06:42, so the day a planet changes sign
 * runs from the previous row to this one; its middle is 12:00 of that clock.
 */
function tableDayMidpointUt(input: BirthInput): number {
  const ms = Date.UTC(input.year, input.month - 1, input.day, 12, 0) - (6 * 60 + 42) * 60_000
  return MakeTime(new Date(ms)).ut
}

// Mercury … Saturn joined 2026-10-04 with the fitted Suriyayat correction:
// on 59 sign-change days checked against astro.meemodel.com, position got
// 50 right, the midday split 42.
const JUDGED_BY_POSITION = new Set(['อาทิตย์', 'จันทร์', 'ราหู', 'เกตุ', 'พุธ', 'ศุกร์', 'อังคาร', 'พฤหัสบดี', 'เสาร์', 'มฤตยู'])

function settleSignChangesOnTheDay(
  lookup: NonNullable<ReturnType<typeof lookupSuryayatSync>>,
  formulaRows: PlanetSignRow[],
  birthUt: number,
  midpointUt: number,
): typeof lookup.signs {
  const prev = lookup.previousDay
  const out = { ...lookup.signs }
  // The table spells กุมภ์, the formula กุมภ — compare without the mark and
  // keep the table's spelling.
  const bare = (sign: string) => sign.replace(/์/g, '')
  // A pinned reference chart is myhora's own answer for that moment: as is.
  if (lookup.source === 'reference') return lookup.signs
  if (!prev) {
    // The table's first day (1 Jan 1941) has no row before it to tell whether
    // a sign changed that day; the birth-moment position of the planets that
    // match myhora decides alone. Its Moon used to take the end-of-day sign.
    for (const planet of JUDGED_BY_POSITION) {
      const now = formulaRows.find((r) => r.planet === planet)?.siderealSign
      const today = lookup.signs[planet]
      if (now && today && bare(now) !== bare(today)) out[planet] = bare(now) === 'กุมภ' ? 'กุมภ์' : now
    }
    return out
  }
  for (const planet of PLANETS) {
    const today = lookup.signs[planet]
    const before = prev[planet]
    if (!today || !before || today === before) continue
    if (JUDGED_BY_POSITION.has(planet)) {
      // Sun and Moon are on myhora's ephemeris (antonathiSamrap.ts), Rahu and
      // Thai Ketu match it (siderealPlanets.ts), Mercury … Saturn carry the
      // fitted correction (suriyayatPlanets.ts). Their birth-moment position
      // decides.
      const now = formulaRows.find((r) => r.planet === planet)?.siderealSign
      if (now && bare(now) === bare(before)) out[planet] = before
    } else if (birthUt < midpointUt) {
      // Every planet now has a Suriyayat position; kept for a planet added
      // without one. Not knowing the hour of the change, split the day.
      out[planet] = before
    }
  }
  return out
}

export function computeFullChartSync(
  input: BirthInput,
  place: PlaceCoords,
): PipelineResult {
  const lookup = lookupSuryayatSync(input, place)
  if (lookup) {
    const formula = fromFormulaPipeline(input, place)
    const suryayatRows = signsToRows(settleSignChangesOnTheDay(
        lookup,
        formula.planets,
        birthAstroTime(input, place).ut,
        tableDayMidpointUt(input),
      ))
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
