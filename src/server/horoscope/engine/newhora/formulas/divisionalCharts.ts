import { SIGNS } from '../data/astrologyConstants'

const MOVABLE = new Set(['เมษ', 'กรกฎ', 'ตุลย์', 'มกร'])
const FIXED = new Set(['พฤษภ', 'สิงห์', 'พิจิก', 'กุมภ'])
function signIndex(sign: string): number {
  const i = SIGNS.indexOf(sign as (typeof SIGNS)[number])
  return i >= 0 ? i : 0
}

function normalizeIndex(i: number): number {
  return ((i % 12) + 12) % 12
}

function offsetSign(baseSign: string, offset: number): string {
  return SIGNS[normalizeIndex(signIndex(baseSign) + offset)] ?? SIGNS[0]
}

export function computeNavamsaSign(sign: string, degreeInSign: number): string {
  const segment = Math.min(8, Math.floor(degreeInSign / (30 / 9)))
  const start = MOVABLE.has(sign)
    ? sign
    : FIXED.has(sign)
      ? offsetSign(sign, 8)
      : offsetSign(sign, 4)
  return offsetSign(start, segment)
}

export function computeDrekkanaSign(sign: string, degreeInSign: number): string {
  const segment = Math.min(2, Math.floor(degreeInSign / 10))
  const start = MOVABLE.has(sign)
    ? sign
    : FIXED.has(sign)
      ? offsetSign(sign, 8)
      : offsetSign(sign, 4)
  const offsets = [0, 4, 8]
  const seq = MOVABLE.has(sign)
    ? offsets
    : FIXED.has(sign)
      ? [...offsets].reverse()
      : [4, 8, 0]
  return offsetSign(start, seq[segment] ?? 0)
}
