import { Body, Observer, SearchRiseSet, type AstroTime } from 'astronomy-engine'
import type { PlaceCoords } from '../data/placeCoordinates'

/** นาทีจากเที่ยงคืนท้องถิ่น (0–1440) */
export function localMinutesFromMidnight(astroTime: AstroTime, utcOffsetMinutes: number): number {
  const utcMs = astroTime.date.getTime()
  const localMs = utcMs + utcOffsetMinutes * 60 * 1000
  const d = new Date(localMs)
  return d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60
}

/** ดวงอาทิตย์ขึ้นวันเดียวกัน (นาทีจากเที่ยงคืน) — สมผุสอาทิตย์อุทัย */
export function sunriseLocalMinutes(
  astroTime: AstroTime,
  place: PlaceCoords,
): number | null {
  try {
    const observer = new Observer(place.lat, place.lon, 0)
    const rise = SearchRiseSet(Body.Sun, observer, 1, astroTime, 1)
    if (!rise) return null
    return localMinutesFromMidnight(rise, place.utcOffsetMinutes)
  } catch {
    return 6 * 60
  }
}

export function birthLocalMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

/** ช่วงนาทีจากอาทิตย์ขึ้นถึงเวลาเกิด (รองรับเกิดหลังเที่ยงคืนก่อนอาทิตย์ขึ้น) */
export function minutesFromSunriseToBirth(
  birthMinutes: number,
  sunriseMinutes: number,
): number {
  let delta = birthMinutes - sunriseMinutes
  if (delta < 0) delta += 1440
  return delta
}
