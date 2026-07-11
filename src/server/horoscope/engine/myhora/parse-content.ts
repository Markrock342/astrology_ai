/** ดึง path / HTML ส่วนเนื้อหาจาก thai.aspx (ตารางสมผุส, คำทำนาย, ฯลฯ) */

function firstLoadPath(html: string, needle: string): string | null {
  const re = new RegExp(`\\.load\\("(/astrology/thai/${needle}[^"]+)"`, 'i')
  return html.match(re)?.[1] ?? null
}

export interface MyhoraContentPaths {
  chartPlanet: string | null
  astrologyNatal: string | null
  astrologyTransit: string | null
  chartBhava: string | null
  chartRasiAnalysisNatal: string | null
  chartRasi10Luck: string | null
}

/** path โหลดเข้า #astrology_natal (มี query ครบ) */
export function parseAstrologyNatalEmbedPath(html: string): string | null {
  return (
    html.match(/#astrology_natal["']?\)\.load\("([^"]+)"/i)?.[1] ??
    firstLoadPath(html, 'astrology-natal\\.aspx')
  )
}

export function parseMyhoraContentPaths(html: string): MyhoraContentPaths {
  return {
    chartPlanet: firstLoadPath(html, 'chart-planet\\.aspx'),
    astrologyNatal: parseAstrologyNatalEmbedPath(html),
    astrologyTransit: firstLoadPath(html, 'astrology-transit\\.aspx'),
    chartBhava: firstLoadPath(html, 'chart-bhava\\.aspx'),
    chartRasiAnalysisNatal: firstLoadPath(html, 'chart-rasi-analysis-natal\\.aspx'),
    chartRasi10Luck: firstLoadPath(html, 'chart-rasi-10luck\\.aspx'),
  }
}

/** ตารางสมผุสดวงกำเนิด — ฝังใน thai.aspx หลัง POST */
export function extractNatalTableHtml(html: string): string | null {
  const m = html.match(
    /id="natal-table"[^>]*>([\s\S]*?)(?=<div id="astrology_natal")/i,
  )
  const inner = m?.[1]?.trim()
  return inner && inner.length > 50 ? inner : null
}

/** ตารางสมผุสดาวจร — ฝังใน thai.aspx หลัง POST (ใน #transit-table) */
export function extractTransitTableHtml(html: string): string | null {
  // Try #transit-table first
  const m1 = html.match(/id="transit-table"[^>]*>([\s\S]*?)(?=<div[^>]*class=['"](?:dd-natal|float-right)['"]|<div id="astrology_transit"|<\/div>\s*<div id="astrology_natal"|$)/i)
  if (m1?.[1]?.trim() && m1[1].trim().length > 50) return m1[1].trim()

  // Fallback: look for ตารางสมผุสดาวจร section
  const m2 = html.match(/ตารางสมผุส(?:ดาว|ดวง)จร[\s\S]*?(<table[\s\S]*?<\/table>)/i)
  if (m2?.[1]?.trim()) return m2[1].trim()

  return null
}
