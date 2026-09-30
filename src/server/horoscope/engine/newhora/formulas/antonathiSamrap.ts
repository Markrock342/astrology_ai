/**
 * ลัคนาอันโตนาทีสามัญ + สมผุสอาทิตย์อุทัย (จานหมุนลัคนาสำเร็จ)
 * @see https://myhora.com/astrology/thai/ascendant-dial.aspx
 *
 * The lagna starts at the Sun's position at sunrise — the Sun is the rising
 * point then — and walks forward through the signs, each taking its antonathi
 * minutes, for the clock time since that sunrise. A birth before dawn belongs
 * to the Thai day that began at the previous sunrise.
 *
 * Checked against myhora's own charts: 1980-10-20 22:15 กรุงเทพฯ, 1992-09-18
 * 07:23 (17.88, 102.74), 1963-04-23 09:15 (13.85, 99.41).
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
/**
 * UTC+07:00 against the Bangkok mean time (UTC+06:42) myhora's day tables are
 * kept in. A birth between midnight and sunrise counts from the previous
 * day's sunrise, and myhora reads that sunrise 18 minutes later: the one
 * pre-dawn myhora chart we hold (18 Nov 2001 02:08 กรุงเทพฯ, กันย์ 12°55')
 * needs 18.6 minutes, every daytime one needs none. One chart — revisit when
 * more pre-dawn charts are available.
 */
const PRE_DAWN_SHIFT_MIN = 18

/** Minutes since the sunrise that began this birth's Thai day. */
export function minutesSinceThaiSunrise(time: AstroTime, lat: number, lon: number): number {
  try {
    const rise = SearchRiseSet(Body.Sun, new Observer(lat, lon, 0), 1, time, -1.5)
    if (rise) {
      const minutes = (time.date.getTime() - rise.date.getTime()) / 60_000
      const day = (d: Date) => new Date(d.getTime() + BANGKOK_MS).toISOString().slice(0, 10)
      const preDawn = day(rise.date) !== day(time.date)
      return preDawn ? minutes - PRE_DAWN_SHIFT_MIN : minutes
    }
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
