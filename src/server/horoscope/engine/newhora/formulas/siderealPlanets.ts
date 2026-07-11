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

/** ลูกหลุมจันทร์เฉลี่ย (ราหู) — องศาเชิงสุริยะ */
export function meanRahuTropicalLongitude(julianUt: number): number {
  const t = (julianUt - 2451545.0) / 36525.0
  const omega =
    125.04452 -
    1934.136261 * t +
    0.0020708 * t * t +
    (t * t * t) / 450000
  return ((omega % 360) + 360) % 360
}

export function meanKetuTropicalLongitude(julianUt: number): number {
  return (meanRahuTropicalLongitude(julianUt) + 180) % 360
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
    if (label === 'ราหู') {
      map.set(
        label,
        placementFromTropical(label, meanRahuTropicalLongitude(julianUt), julianUt),
      )
      continue
    }
    if (label === 'เกตุ') {
      map.set(
        label,
        placementFromTropical(label, meanKetuTropicalLongitude(julianUt), julianUt),
      )
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
