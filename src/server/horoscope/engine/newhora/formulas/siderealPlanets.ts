import {
  Body,
  Ecliptic,
  GeoVector,
  type AstroTime,
} from 'astronomy-engine'
import { PLANETS } from '../data/astrologyConstants'
import { tropicalToSidereal } from './lahiri'

export interface SiderealPlacement {
  label: string
  siderealLongitude: number
  siderealSign: string
  degreeInSign: number
  degreeText: string
}

const SIGN_NAMES = [
  'เมษ',
  'พฤษภ',
  'มิถุน',
  'กรกฎ',
  'สิงห์',
  'กันย์',
  'ตุลย์',
  'พิจิก',
  'ธนู',
  'มกร',
  'กุมภ',
  'มีน',
] as const

const BODY_BY_LABEL: Partial<Record<(typeof PLANETS)[number], Body>> = {
  อาทิตย์: Body.Sun,
  จันทร์: Body.Moon,
  อังคาร: Body.Mars,
  พุธ: Body.Mercury,
  พฤหัสบดี: Body.Jupiter,
  ศุกร์: Body.Venus,
  เสาร์: Body.Saturn,
  มฤตยู: Body.Uranus,
}

export function signFromSiderealLongitude(lon: number): {
  sign: string
  degreeInSign: number
} {
  const n = ((lon % 360) + 360) % 360
  const index = Math.floor(n / 30) % 12
  const degreeInSign = n % 30
  return { sign: SIGN_NAMES[index] ?? 'เมษ', degreeInSign }
}

export function formatDegreeInSign(degreeInSign: number): string {
  const deg = Math.floor(degreeInSign)
  const min = Math.floor((degreeInSign - deg) * 60)
  return `${deg}° ${String(min).padStart(2, '0')}'`
}

function tropicalEclipticLongitude(body: Body, time: AstroTime): number {
  const vec = GeoVector(body, time, true)
  const ecl = Ecliptic(vec)
  return ((ecl.elon % 360) + 360) % 360
}

/**
 * ราหูไทย (สุริยยาตร์) — a steady backward motion in the sidereal zodiac, like
 * เกตุ below. The mean node minus Lahiri sat 25′ (1905) to 47′ (2046) ahead of
 * myhora's Rahu (via astro.meemodel.com), enough to move its นวางศ์ about one
 * birth in five. Fitted to meemodel's Rahu (audit 2026-11-25, see
 * tests/thai-rahu.test.ts): median error 0.3′. Sidereal already; no ayanamsa.
 */
export const THAI_RAHU_AT_J2000 = 100.5171
export const THAI_RAHU_DEG_PER_DAY = -0.0529993621
export function thaiRahuSiderealLongitude(daysSinceJ2000: number): number {
  const lon = THAI_RAHU_AT_J2000 + THAI_RAHU_DEG_PER_DAY * daysSinceJ2000
  return ((lon % 360) + 360) % 360
}

/**
 * เกตุไทย (สุริยยาตร์) — not the node opposite Rahu but its own point, moving
 * backwards one full circle every 679 days. Read off 84 dates 1916–2031 from
 * astro.meemodel.com (whose planets match myhora): median error 0.01°. Checked
 * against the 100-year table: 98.7% of 2,000 days in the same sign, every miss
 * within 0.6° of a sign edge. Sidereal already; no ayanamsa.
 */
export function thaiKetuSiderealLongitude(daysSinceJ2000: number): number {
  const lon = 357.3212 - (360 / 679) * daysSinceJ2000
  return ((lon % 360) + 360) % 360
}

function placementFromTropical(
  label: string,
  tropicalLon: number,
  julianUt: number,
): SiderealPlacement {
  const siderealLongitude = tropicalToSidereal(tropicalLon, julianUt)
  const { sign, degreeInSign } = signFromSiderealLongitude(siderealLongitude)
  return {
    label,
    siderealLongitude,
    siderealSign: sign,
    degreeInSign,
    degreeText: formatDegreeInSign(degreeInSign),
  }
}

export function computeSiderealPlanets(time: AstroTime): Map<string, SiderealPlacement> {
  const julianUt = time.ut
  const map = new Map<string, SiderealPlacement>()

  for (const label of PLANETS) {
    if (label === 'ราหู' || label === 'เกตุ') {
      const siderealLongitude =
        label === 'ราหู' ? thaiRahuSiderealLongitude(julianUt) : thaiKetuSiderealLongitude(julianUt)
      const { sign, degreeInSign } = signFromSiderealLongitude(siderealLongitude)
      map.set(label, {
        label,
        siderealLongitude,
        siderealSign: sign,
        degreeInSign,
        degreeText: formatDegreeInSign(degreeInSign),
      })
      continue
    }
    const body = BODY_BY_LABEL[label]
    if (!body) continue
    const tropical = tropicalEclipticLongitude(body, time)
    map.set(label, placementFromTropical(label, tropical, julianUt))
  }

  return map
}

export function signIndex(sign: string): number {
  const i = SIGN_NAMES.indexOf(sign as (typeof SIGN_NAMES)[number])
  return i >= 0 ? i : 0
}
