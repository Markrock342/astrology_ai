import type { BirthInput } from "../../types/astrology";
import type { PlaceCoords } from "../../data/placeCoordinates";
import { parseTime } from "../../dateTimeUtils";

/** คีย์สำหรับ lookup ปฏิทินร้อยปี — ปัดพิกัด 2 ตำแหน่ง */
export function suryayatCalendarKey(
  input: BirthInput,
  place: PlaceCoords,
): string {
  const t = parseTime(input.time);
  const hh = String(t?.hours ?? 0).padStart(2, "0");
  const mm = String(t?.minutes ?? 0).padStart(2, "0");
  const lat = place.lat.toFixed(2);
  const lon = place.lon.toFixed(2);
  return `${input.year}-${String(input.month).padStart(2, "0")}-${String(input.day).padStart(2, "0")}T${hh}:${mm}|${lat}|${lon}`;
}

/** ปี พ.ศ. สำหรับชื่อไฟล์ปฏิทิน */
export function buddhistYear(ceYear: number): number {
  return ceYear + 543;
}

/** คีย์วันในไฟล์ปี: MM-DD หรือ MM-DDTHH:mm */
export function suryayatDayKey(input: BirthInput, withTime = true): string {
  const month = String(input.month).padStart(2, "0");
  const day = String(input.day).padStart(2, "0");
  if (!withTime) return `${month}-${day}`;
  const t = parseTime(input.time);
  const hh = String(t?.hours ?? 0).padStart(2, "0");
  const mm = String(t?.minutes ?? 0).padStart(2, "0");
  return `${month}-${day}T${hh}:${mm}`;
}
