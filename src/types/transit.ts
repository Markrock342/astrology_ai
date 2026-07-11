/** วันจร (ดวงจร) — ตรงฟิลด์ dd_day2 / dd_transit_date_option ใน myhora */

export interface TransitInput {
  day: number
  month: number
  /** ค.ศ. */
  year: number
  /** HH:mm */
  time: string
  /**
   * ค่า dd_transit_date_option — ว่าง = ใช้วันที่ dd_day2 ด้านบน
   * เช่น newmoon, fullmoon, vernal-equinox
   */
  preset?: string
}

/** ตัวเลือกดวงจรแบบ myhora */
export const TRANSIT_DATE_PRESETS: { value: string; label: string }[] = [
  { value: '', label: 'ดวงจร (กำหนดวันที่)' },
  { value: 'newmoon', label: 'ดวงอมาวสี (New Moon)' },
  { value: 'fullmoon', label: 'ดวงปูรณมี (Full Moon)' },
  { value: 'firstquarter', label: 'ดวงจันทร์กึ่งข้างขึ้น' },
  { value: 'lastquarter', label: 'ดวงจันทร์กึ่งข้างแรม' },
  { value: 'vernal-equinox', label: 'ดวงวสันตวิษุวัต' },
  { value: 'summer-solstice', label: 'ดวงครีษมายัน' },
  { value: 'autumnal-equinox', label: 'ดวงสารทวิษุวัต' },
  { value: 'winter-solstice', label: 'ดวงเหมายัน' },
  { value: 'solar-eclipse', label: 'ดวงสุริยคราส' },
  { value: 'lunar-eclipse', label: 'ดวงจันทรคราส' },
]

export function defaultTransitInput(now = new Date()): TransitInput {
  return {
    day: now.getDate(),
    month: now.getMonth() + 1,
    year: now.getFullYear(),
    time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
    preset: '',
  }
}
