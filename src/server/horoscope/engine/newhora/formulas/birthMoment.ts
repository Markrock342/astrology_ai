import { MakeTime, type AstroTime } from 'astronomy-engine'
import type { BirthInput } from '../types/astrology'
import type { PlaceCoords } from '../data/placeCoordinates'
import { parseTime } from '../dateTimeUtils'

/** เวลาเกิดท้องถิ่น → UTC สำหรับ ephemeris */
export function birthAstroTime(input: BirthInput, place: PlaceCoords): AstroTime {
  const time = parseTime(input.time)
  const hours = time?.hours ?? 0
  const minutes = time?.minutes ?? 0
  const localMs = Date.UTC(
    input.year,
    input.month - 1,
    input.day,
    hours,
    minutes,
    0,
    0,
  )
  const utcMs = localMs - place.utcOffsetMinutes * 60 * 1000
  return MakeTime(new Date(utcMs))
}

export function birthJulianUt(astroTime: AstroTime): number {
  return astroTime.ut
}
