/**
 * ลัคนาอันโตนาทีสามัญ + สมผุสอาทิตย์อุทัย (จานหมุนลัคนาสำเร็จ)
 * @see https://myhora.com/astrology/thai/ascendant-dial.aspx
 *
 * The lagna starts at the Sun's position at sunrise — the Sun is the rising
 * point then — and walks forward through the signs, each taking its antonathi
 * minutes, for the clock time since that sunrise. A birth before dawn belongs
 * to the Thai day that began at the previous sunrise.
 *
 * Checked against sixteen myhora charts (tests/fallback-lagna.test.ts). Three
 * charts copied from myhora's calendar-ascendant page fit only without the
 * local-time adjustment — that page runs without it.
 * The Sun is taken at birth, as myhora's dial does, and moved onto the
 * Suriyayat ephemeris first (see suriyayatSunLongitude).
 */

import { Body, Observer, SearchRiseSet, type AstroTime } from 'astronomy-engine'
import { antonathiClockMinutesForSign } from '../data/antonathiCommon'
import { signFromSiderealLongitude } from './siderealPlanets'

/** Walk `minutes` of clock time from `startLon` through the antonathi table. */
export function walkAntonathi(startLon: number, minutes: number): number {
  let lon = ((startLon % 360) + 360) % 360
  let remaining = ((minutes % 1440) + 1440) % 1440
  for (;;) {
    const sign = Math.floor(lon / 30)
    const perDegree = antonathiClockMinutesForSign(sign) / 30
    const toNextSign = (30 - (lon - sign * 30)) * perDegree
    if (remaining < toNextSign) return (lon + remaining / perDegree) % 360
    remaining -= toNextSign
    lon = ((sign + 1) % 12) * 30
  }
}

const BANGKOK_MS = 7 * 3_600_000
/** Thai standard time's meridian (UTC+07:00). */
const STANDARD_MERIDIAN = 105
/**
 * "ปรับเวลาท้องถิ่น": the birth time becomes local mean time, 4 minutes per
 * degree of longitude from 105°E — so กรุงเทพฯ (100.5°E) counts 18 minutes
 * less, แม่ฮ่องสอน 28. Read off sixteen of myhora's charts captured by the
 * owner (2026-09-30 and 10-01): every one lands within 1 minute of this
 * shift, day, night and before dawn alike.
 */

/** Minutes since the sunrise that began this birth's Thai day, as myhora counts them. */
export function minutesSinceThaiSunrise(time: AstroTime, lat: number, lon: number): number {
  const localShift = (lon - STANDARD_MERIDIAN) * 4
  try {
    const rise = SearchRiseSet(Body.Sun, new Observer(lat, lon, 0), 1, time, -1.5)
    if (rise) return (time.date.getTime() - rise.date.getTime()) / 60_000 + localShift
  } catch {
    /* polar or search failure — fall through */
  }
  // No sunrise found: count from 06:00 local clock (UTC+7).
  const local = new Date(time.date.getTime() + BANGKOK_MS)
  const clock = local.getUTCHours() * 60 + local.getUTCMinutes()
  return (clock - 360 + 1440) % 1440
}

export interface AntonathiLagnaResult {
  sign: string
  siderealLongitude: number
  degreeInSign: number
  minutesFromSunrise: number
}

export function computeAntonathiSamrapLagna(
  time: AstroTime,
  lat: number,
  lon: number,
  sunSiderealLongitude: number,
): AntonathiLagnaResult {
  const minutesFromSunrise = minutesSinceThaiSunrise(time, lat, lon)
  const sun = suriyayatSunLongitude(sunSiderealLongitude, time.ut)
  const lagnaLon = walkAntonathi(sun, minutesFromSunrise)
  const { sign, degreeInSign } = signFromSiderealLongitude(lagnaLon)
  return { sign, siderealLongitude: lagnaLon, degreeInSign, minutesFromSunrise }
}

/**
 * The Sun as the Suriyayat ephemeris has it, from our Lahiri Sun.
 *
 * myhora's dial starts from its own (Suriyayat) Sun, which sits up to ~0.6°
 * from Lahiri; the dial carries that into the lagna, magnified in short signs.
 * Fitted on 60 dates 1941–2040 from astro.meemodel.com, whose planets match
 * myhora to the arc-minute (checked on 18 Nov 2001: Sun พิจิก 1°08', Rahu
 * มิถุน 4°09' on both). Held-out error ≤ 2.7′.
 */
export function suriyayatSunLongitude(lahiriSunLon: number, daysSinceJ2000: number): number {
  const t = daysSinceJ2000 / 36525
  const l = (lahiriSunLon * Math.PI) / 180
  const correction =
    -0.255561 -
    0.239288 * t -
    0.010581 * Math.sin(l) +
    0.294551 * Math.cos(l) +
    0.024062 * Math.sin(2 * l) +
    0.003366 * Math.cos(2 * l)
  return (((lahiriSunLon + correction) % 360) + 360) % 360
}
