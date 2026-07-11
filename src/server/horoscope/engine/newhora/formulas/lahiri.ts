/** อายนางศา ลาหิรี (ใกล้เคียง Swiss Ephemeris SE_SIDM_LAHIRI) */

export function lahiriAyanamsaDegrees(daysSinceJ2000: number): number {
  const t = (daysSinceJ2000 + 36525.0) / 36525.0
  const arcsec =
    5028.796195 * t +
    1.1124348 * t * t +
    (t * t * t) / 467410 -
    (t * t * t * t) / 60616000
  return (22.460148 + arcsec / 3600) % 360
}

export function tropicalToSidereal(tropicalLon: number, daysSinceJ2000: number): number {
  let sid = tropicalLon - lahiriAyanamsaDegrees(daysSinceJ2000)
  sid = ((sid % 360) + 360) % 360
  return sid
}
