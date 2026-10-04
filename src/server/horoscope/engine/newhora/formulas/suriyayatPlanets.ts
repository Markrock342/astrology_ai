import fit from '../data/suriyayat-planet-fit.json'

/**
 * Mercury … Saturn as the Suriyayat ephemeris has them (myhora's), from our
 * Lahiri positions. The old text's planets are mean motion plus two
 * epicycles (มันทะ, ศีฆระ); modern ones are not, and the two part by up to
 * 21° (Mercury), 12° (Venus, Mars), 6° (Saturn). The correction is a
 * harmonic series in the planet's mean anomaly, its synodic angle and its
 * elongation from the Sun, fitted on 500 moments 1916–2040 from
 * astro.meemodel.com (matches myhora to the arc-minute). Held out:
 * Mercury/Venus median 15′ (max 1.5°), Mars 12′, Jupiter 5′ (max 18′),
 * Saturn 6′ (max 24′); sign right 97–100 of 100. Uranus (มฤตยู), added
 * the same day: Lahiri was 4° off at the median (10° max, wrong sign 75 of
 * 500); fitted, max 3.7′.
 */

type PlanetKey = 'mercury' | 'venus' | 'mars' | 'jupiter' | 'saturn' | 'uranus'

const ELEMENTS: Record<PlanetKey, { M0: number; n: number; L0: number }> = {
  mercury: { M0: 174.7948, n: 4.09233445, L0: 252.2509 },
  venus: { M0: 50.4161, n: 1.60213034, L0: 181.9798 },
  mars: { M0: 19.373, n: 0.52402068, L0: 355.433 },
  jupiter: { M0: 20.0202, n: 0.08308529, L0: 34.3515 },
  saturn: { M0: 317.0207, n: 0.03344414, L0: 50.0774 },
  uranus: { M0: 142.5905, n: 0.011725806, L0: 313.2322 },
}

const BY_THAI_NAME: Record<string, PlanetKey> = {
  พุธ: 'mercury',
  ศุกร์: 'venus',
  อังคาร: 'mars',
  พฤหัสบดี: 'jupiter',
  เสาร์: 'saturn',
  มฤตยู: 'uranus',
}

const COEFFS = fit as Record<PlanetKey, number[]>
const RAD = Math.PI / 180
const HARM = 3
const ELONGATION_HARM = 3

/** Same features, same order, as the fit. */
function features(lon: number, sunLon: number, d: number, el: { M0: number; n: number; L0: number }): number[] {
  const t = d / 36525
  const M = (el.M0 + el.n * d) * RAD
  const Q = (el.L0 + el.n * d - (280.46 + 0.98564736 * d)) * RAD
  const Ms = (357.529 + 0.98560028 * d) * RAD
  const f = [1, t]
  for (let a = 0; a <= HARM; a++) {
    for (let b = -HARM; b <= HARM; b++) {
      if (a === 0 && b <= 0) continue
      if (Math.abs(a) + Math.abs(b) > HARM + 1) continue
      f.push(Math.sin(a * M + b * Q), Math.cos(a * M + b * Q))
    }
  }
  f.push(Math.sin(Ms), Math.cos(Ms), Math.sin(lon * RAD), Math.cos(lon * RAD))
  const E = (lon - sunLon) * RAD
  for (let k = 1; k <= ELONGATION_HARM; k++) {
    f.push(Math.sin(k * E), Math.cos(k * E), Math.sin(k * E + M), Math.cos(k * E + M), Math.sin(k * E - M), Math.cos(k * E - M))
  }
  return f
}

export function hasSuriyayatPlanetFit(planet: string): boolean {
  return planet in BY_THAI_NAME
}

/** Suriyayat sidereal longitude of `planet` from its Lahiri one and the Lahiri Sun's. */
export function suriyayatPlanetLongitude(
  planet: string,
  lahiriLon: number,
  lahiriSunLon: number,
  daysSinceJ2000: number,
): number {
  const key = BY_THAI_NAME[planet]
  if (!key) return lahiriLon
  const x = features(lahiriLon, lahiriSunLon, daysSinceJ2000, ELEMENTS[key])
  const w = COEFFS[key]
  const correction = x.reduce((sum, v, i) => sum + v * (w[i] ?? 0), 0)
  return (((lahiriLon + correction) % 360) + 360) % 360
}
