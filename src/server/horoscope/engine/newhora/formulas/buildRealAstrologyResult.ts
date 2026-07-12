/**
 * คำนวณจริง → ตาราง ดาว | สถิตราศี (server port จาก newhora)
 * Scrape-first อยู่ที่ engine/compute-chart.ts — ไฟล์นี้เป็น formula fallback orchestrator
 */

import { CALCULATION_SETTINGS } from '../data/calculationSettings'
import { resolvePlaceCoords } from '../data/placeCoordinates'
import type { AstrologyResult, BirthInput } from '../types/astrology'
import { formatBirthDisplay, formatLocationDisplay } from '../dateTimeUtils'
import { computeFullChartSync } from './pipeline'

function toResult(
  input: BirthInput,
  chart: ReturnType<typeof computeFullChartSync>,
): AstrologyResult {
  return {
    input,
    calculatedAt: new Date().toISOString(),
    settings: { ...CALCULATION_SETTINGS },
    meta: {
      birthDisplay: formatBirthDisplay(input),
      locationDisplay: formatLocationDisplay(input),
      calculationSource: chart.source,
      lagna: chart.lagna,
    },
    planets: chart.planets,
    chart: {
      lagna: chart.lagna,
      taksa: chart.taksa,
    },
  }
}

/** สูตรท้องถิ่น (สุริยยาตร์ / อันโตนาที / ลาหิรี) — ไม่ scrape */
export function buildRealAstrologyResult(input: BirthInput): AstrologyResult {
  const place = resolvePlaceCoords(input.country, input.province, input.district)
  return toResult(input, computeFullChartSync(input, place))
}

export async function buildRealAstrologyResultAsync(
  input: BirthInput,
): Promise<AstrologyResult> {
  return buildRealAstrologyResult(input)
}
