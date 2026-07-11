/** ดึง innerHTML ของ element ตาม id (รองรับ div ซ้อน) */
export function extractInnerHtmlById(html: string, elementId: string): string | null {
  const re = new RegExp(
    `<([a-z][a-z0-9]*)\\s[^>]*\\bid=["']${elementId}["'][^>]*>`,
    'i',
  )
  const open = re.exec(html)
  if (!open || open.index === undefined) return null

  const tag = open[1].toLowerCase()
  const start = open.index + open[0].length
  if (tag === 'div') {
    return extractBalancedDivInner(html, start)
  }

  const closeRe = new RegExp(`</${tag}>`, 'i')
  const close = closeRe.exec(html.slice(start))
  if (!close) return null
  return html.slice(start, start + close.index).trim()
}

function extractBalancedDivInner(html: string, contentStart: number): string | null {
  let depth = 1
  let i = contentStart
  const lower = html.toLowerCase()

  while (i < html.length && depth > 0) {
    const nextOpen = lower.indexOf('<div', i)
    const nextClose = lower.indexOf('</div>', i)

    if (nextClose === -1) return null

    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth++
      i = nextOpen + 4
      continue
    }

    depth--
    if (depth === 0) {
      return html.slice(contentStart, nextClose).trim()
    }
    i = nextClose + 6
  }

  return null
}
