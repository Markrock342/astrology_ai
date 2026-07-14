/**
 * Make a HALF-TYPED markdown string safe to render.
 *
 * The typewriter feeds react-markdown a growing prefix of the answer, so the
 * parser is constantly handed markdown that is syntactically incomplete — and it
 * renders exactly that:
 *
 *   - a table mid-arrival is just pipes, so `| ดาว | เรือน |` shows as literal
 *     `|` characters for a beat and then SNAPS into a table, jumping the layout;
 *   - an unclosed ``` fence leaves the rest of the answer rendered as prose;
 *   - a dangling `**` shows as raw asterisks until its partner lands.
 *
 * None of that is wrong markdown — it is a correct rendering of an incomplete
 * document. The fix is to complete the document, not the renderer: close what is
 * open, and withhold the one trailing construct that cannot be read yet.
 *
 * Conservative on purpose. This runs on every animation frame and it must never
 * corrupt the FINAL text, so it only ever appends a closer or hides the last few
 * lines — it never rewrites content.
 */

/** A table row is only a table once the `|---|---|` separator has arrived. */
function isTableRow(line: string): boolean {
  return /^\s*\|.*\|?\s*$/.test(line) && line.includes("|");
}

function isTableSeparator(line: string): boolean {
  return /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/.test(line) && line.includes("-");
}

export function completeMarkdown(text: string): string {
  if (!text) return text;

  let out = text;

  // 1. Unclosed code fence. Count them: an odd number means we are inside one.
  //    Close it, so the tail renders as code instead of leaking into prose.
  const fences = out.match(/^```/gm);
  if (fences && fences.length % 2 === 1) {
    out += out.endsWith("\n") ? "```" : "\n```";
    // Inside a fence nothing else is markdown, so stop here.
    return out;
  }

  const lines = out.split("\n");

  // 2. A table that has begun but has no separator row yet renders as a pipe
  //    salad. Withhold those trailing rows until it is legible — better a beat
  //    of nothing than a beat of garbage that then rearranges itself.
  let firstRow = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (line.trim() === "") break;
    if (!isTableRow(line)) break;
    firstRow = i;
  }
  if (firstRow >= 0) {
    const block = lines.slice(firstRow);
    const hasSeparator = block.some(isTableSeparator);
    // A separated table with a partial LAST row is fine — remark renders the
    // complete rows. Only an entirely unseparated block is unreadable.
    if (!hasSeparator) {
      out = lines.slice(0, firstRow).join("\n");
    }
  }

  // 3. Dangling inline emphasis: strip the orphan marker rather than show it.
  //    Only touches the very end of the string, and only when unpaired.
  for (const marker of ["**", "__", "*", "_", "`"]) {
    const count = out.split(marker).length - 1;
    if (count % 2 === 1 && out.endsWith(marker)) {
      out = out.slice(0, -marker.length);
      break;
    }
  }

  return out;
}
