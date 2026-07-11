/**
 * ลัคนาอันโตนาทีสามัญ + สมผุสอาทิตย์อุทัย (จานหมุนลัคนาสำเร็จ)
 * @see https://myhora.com/astrology/thai/ascendant-dial.aspx
 */

import type { AstroTime } from 'astronomy-engine'
import {
  antonathiClockMinutesForSign,
  signIndexFromName,
} from '../data/antonathiCommon'
import { Body, Ecliptic, GeoVector } from 'astronomy-engine'
import { tropicalToSidereal } from './lahiri'
import { signFromSiderealLongitude } from './siderealPlanets'
import { minutesFromSunriseToBirth } from './sunrise'

function sunTropicalLongitude(time: AstroTime): number {
  const vec = GeoVector(Body.Sun, time, true)
  const ecl = Ecliptic(vec)
  return ((ecl.elon % 360) + 360) % 360
}

/** เดินองศาสถิตรตามอันโตนาที จากจุดเริ่ม */
function arcDegreesForClockMinutes(
  clockMinutes: number,
  startSignIndex: number,
  startDegInSign: number,
): number {
  let remaining = clockMinutes
  let signIdx = startSignIndex
  let degInSign = startDegInSign
  let arc = 0

  while (remaining > 1e-6) {
    const signClockMin = antonathiClockMinutesForSign(signIdx)
    const degLeft = 30 - degInSign
    const minutesForRestOfSign = signClockMin * (degLeft / 30)

    if (remaining <= minutesForRestOfSign) {
      arc += (remaining / minutesForRestOfSign) * degLeft
      return arc
    }

    remaining -= minutesForRestOfSign
    arc += degLeft
    signIdx = (signIdx + 1) % 12
    degInSign = 0
  }

  return arc
}

export interface AntonathiLagnaResult {
  sign: string
  siderealLongitude: number
  degreeInSign: number
  sunriseMinutes: number
  minutesFromSunrise: number
}

/** ลัคนาจากดวงอาทิตย์ ณ อาทิตย์ขึ้น + ช่วงเวลาถึงเกิด */
export function computeAntonathiSamrapLagna(
  timeAtSunrise: AstroTime,
  birthMinutes: number,
  sunriseMinutes: number,
): AntonathiLagnaResult {
  const tropicalSunRise = sunTropicalLongitude(timeAtSunrise)
  const sunLonRise = tropicalToSidereal(tropicalSunRise, timeAtSunrise.ut)
  const { sign: sunSign, degreeInSign: sunDeg } = signFromSiderealLongitude(sunLonRise)
  const sunSignIdx = signIndexFromName(sunSign)

  const deltaMin = minutesFromSunriseToBirth(birthMinutes, sunriseMinutes)
  const arc = arcDegreesForClockMinutes(deltaMin, sunSignIdx, sunDeg)
  const lagnaLon = (sunLonRise + arc) % 360
  const { sign, degreeInSign } = signFromSiderealLongitude(lagnaLon)

  return {
    sign,
    siderealLongitude: lagnaLon,
    degreeInSign,
    sunriseMinutes,
    minutesFromSunrise: deltaMin,
  }
}
