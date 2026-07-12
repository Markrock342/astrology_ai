import { SiderealTime, type AstroTime } from 'astronomy-engine'
import { tropicalToSidereal } from './lahiri'
import { formatDegreeInSign, signFromSiderealLongitude } from './siderealPlanets'

/** ลัคนาเชิงสุริยะ → สถิตร (ลาหิรี) — ยังไม่รวมกฎอันโตนาทีแบบ myhora ทุกขั้น */
export function computeSiderealAscendant(
  time: AstroTime,
  lat: number,
  lon: number,
): { sign: string; longitude: number; degreeText: string } {
  const gstHours = SiderealTime(time)
  let lstHours = gstHours + lon / 15
  lstHours = ((lstHours % 24) + 24) % 24
  const ramc = (lstHours * 15 * Math.PI) / 180
  const latRad = (lat * Math.PI) / 180
  const obl = (23.4392911 * Math.PI) / 180
  const ascRad = Math.atan2(
    Math.cos(ramc),
    -Math.sin(ramc) * Math.cos(obl) - Math.tan(latRad) * Math.sin(obl),
  )
  let tropicalAsc = (ascRad * 180) / Math.PI
  if (tropicalAsc < 0) tropicalAsc += 360
  const sidereal = tropicalToSidereal(tropicalAsc, time.ut)
  const { sign, degreeInSign } = signFromSiderealLongitude(sidereal)
  return {
    sign,
    longitude: sidereal,
    degreeText: formatDegreeInSign(degreeInSign),
  }
}
