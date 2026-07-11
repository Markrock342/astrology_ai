/** path กราฟวงกลมหลัก #chart_natal บน thai.aspx (โหลดหลัง POST) */

export function parseNatalAnalysisChartPath(html: string): string | null {
  const quoted =
    html.match(/\$\(["']#chart_natal["']\)\.load\(["']([^"']+)["']/i)?.[1] ??
    html.match(/#chart_natal["']\)\.load\(["']([^"']+)["']/i)?.[1] ??
    null
  if (quoted?.includes('chart-rasi-analysis-natal.aspx')) return quoted

  const bare = html.match(
    /(\/astrology\/thai\/chart-rasi-analysis-natal\.aspx\?[^"'<>\\]+)/i,
  )?.[1]
  return bare ?? null
}

/** SVG วงกลมจริง — อยู่ใน chart-rasi-analysis-natal.aspx ผ่าน <object data="..."> */
export function parseNatalSvgChartPath(analysisHtml: string): string | null {
  return (
    analysisHtml.match(
      /data=["'](\/astrology\/thai\/images\/chart-natal\.aspx[^"']+)["']/i,
    )?.[1] ?? null
  )
}
