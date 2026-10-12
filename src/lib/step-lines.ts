/**
 * Lists the team types one item per line (package features, purchase steps).
 * Enter starts the next numbered step; Shift+Enter breaks the line inside the
 * same step (A, 12 Oct 2026). In the textarea that continuation line is
 * indented by two spaces; in the saved list it is a "\n" inside the item.
 */
const CONTINUATION = "  ";

export function linesToItems(text: string): string[] {
  const items: string[] = [];
  for (const raw of text.split("\n")) {
    const continues = /^[ \t]/.test(raw) && items.length > 0;
    const line = raw.trim();
    if (!line) continue;
    if (continues) items[items.length - 1] += `\n${line}`;
    else items.push(line);
  }
  return items;
}

export function itemsToLines(items: string[]): string {
  return items.map((item) => item.split("\n").join(`\n${CONTINUATION}`)).join("\n");
}

/** Shift+Enter in such a textarea: a line break that stays in this step. */
export function onStepKeyDown(
  e: React.KeyboardEvent<HTMLTextAreaElement>,
  setValue: (next: string) => void,
) {
  if (e.key !== "Enter" || !e.shiftKey || e.nativeEvent.isComposing) return;
  e.preventDefault();
  const el = e.currentTarget;
  const { selectionStart: start, selectionEnd: end, value } = el;
  const next = `${value.slice(0, start)}\n${CONTINUATION}${value.slice(end)}`;
  setValue(next);
  const caret = start + 1 + CONTINUATION.length;
  requestAnimationFrame(() => el.setSelectionRange(caret, caret));
}
