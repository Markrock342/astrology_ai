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
 * 07:23 (17.88, 102.74), 1963-04-23 09:15 (13.85, 99.41) — all within 0.2°.
 * The Sun is taken at birth, as myhora's dial does; it moves under a degree a
 * day, so the difference is small either way.
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

/** Minutes since the sunrise that began this birth's Thai day. */
export function minutesSinceThaiSunrise(time: AstroTime, lat: number, lon: number): number {
  try {
    const rise = SearchRiseSet(Body.Sun, new Observer(lat, lon, 0), 1, time, -1.5)
    if (rise) return (time.date.getTime() - rise.date.getTime()) / 60_000
  } catch {
    /* polar or search failure — fall through */
  }
  // No sunrise found: count from 06:00 local clock (UTC+7).
  const local = new Date(time.date.getTime() + 7 * 3_600_000)
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
  const lagnaLon = walkAntonathi(sunSiderealLongitude, minutesFromSunrise)
  const { sign, degreeInSign } = signFromSiderealLongitude(lagnaLon)
  return { sign, siderealLongitude: lagnaLon, degreeInSign, minutesFromSunrise }
}
