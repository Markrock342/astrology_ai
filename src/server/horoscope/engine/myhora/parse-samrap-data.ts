import type { MyhoraNatalPlanet } from "@/types/myhora";

/**
 * Extracts structured JSON data from the raw Myhora natal table HTML.
 * The table from Myhora contains 15 columns of data for each planet.
 */
export function extractNatalTableData(html: string | null): MyhoraNatalPlanet[] | null {
  if (!html) return null

  function extractRowByClass(htmlStr: string, className: string): string[] | null {
    const re = new RegExp(`<tr\\b[^>]*class=['"][^'"]*\\b${className}\\b[^'"]*['"][^>]*>([\\s\\S]*?)<\/tr>`, 'i')
    const m = htmlStr.match(re)
    if (!m) return null
    
    const tdRe = /<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi
    const cells: string[] = []
    let td: RegExpExecArray | null
    while ((td = tdRe.exec(m[1])) !== null) {
      cells.push(
        td[1]
          .replace(/<[^>]+>/g, '') 
          .replace(/&nbsp;/gi, '') 
          .trim()
          .replace(/\s+/g, ' ')
      )
    }
    return cells
  }

  const isTransit = html.includes('class="ttr1"') || html.includes("class='ttr1'") || html.includes('ttr1')
  const prefix = isTransit ? 't' : ''
  const planets: MyhoraNatalPlanet[] = []

  const planetOrder = [
    /^(ลัคนา|ล\.ลัคนา|ล\.)/,
    /^(อาทิตย์|๑\.อาทิตย์|๑\.)/,
    /^(จันทร์|๒\.จันทร์|๒\.)/,
    /^(อังคาร|๓\.อังคาร|๓\.)/,
    /^(พุธ|๔\.พุธ|๔\.)/,
    /^(พฤหัสบดี|พฤหัส|๕\.พฤหัสบดี|๕\.)/,
    /^(ศุกร์|๖\.ศุกร์|๖\.)/,
    /^(เสาร์|๗\.เสาร์|๗\.)/,
    /^(ราหู|๘\.ราหู|๘\.)/,
    /^(เกตุ|๙\.เกตุ|๙\.)/,
    /^(มฤตยู|๐\.มฤตยู|๐\.)/
  ]

  function getPlanetIndex(text: string): number {
    for (let i = 0; i < planetOrder.length; i++) {
      if (planetOrder[i].test(text)) return i
    }
    return 999
  }

  let i = 1
  while (true) {
    const pCells = extractRowByClass(html, `${prefix}tr${i}`)
    if (!pCells && i > 11) {
      break
    }

    if (pCells && pCells.length >= 4) {
      const dCells = extractRowByClass(html, `${prefix}trx${i}`)
      const planet = pCells[0]
      const zodiac = pCells[1]
      const degree = pCells[2]
      const minute = pCells[3]

      let house = ''
      let triyang = ''
      let poison = ''
      let nawamang = ''
      let rerk = ''
      let rerkName = ''
      let baht = ''
      let rerk2 = ''
      let rerkBig = ''
      let rerkOwner = ''
      let rerkStandard = ''

      if (dCells && dCells.length >= 12) {
        house = dCells[0]
        triyang = dCells[1]
        poison = dCells[2]
        nawamang = dCells[3]
        // dCells[4] is spacer cell
        rerk = dCells[5]
        rerkName = dCells[6]
        baht = dCells[7]
        rerk2 = dCells[8]
        rerkBig = dCells[9]
        rerkOwner = dCells[10]
        rerkStandard = dCells[11]
      }

      planets.push({
        planet,
        zodiac,
        degree,
        minute,
        house,
        triyang,
        poison,
        nawamang,
        rerk,
        rerkName,
        baht,
        rerk2,
        rerkBig,
        rerkOwner,
        rerkStandard
      })
    }
    i++
  }

  // Sort by traditional order
  planets.sort((a, b) => getPlanetIndex(a.planet) - getPlanetIndex(b.planet))

  return planets.length > 0 ? planets : null
}
