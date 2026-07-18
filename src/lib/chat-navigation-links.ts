export const OPEN_TRANSIT_EVENT = "horasard:open-transit";

const CATEGORY_ROUTES: Record<string, string> = {
  ตัวตน: "self",
  การงาน: "career",
  การเงิน: "finance",
  ความรัก: "love",
  สุขภาพ: "health",
  โชคลาภ: "fortune",
};

function alreadyLinked(source: string, offset: number, match: string): boolean {
  const prefix = source.slice(0, offset);
  const insideLinkLabel = prefix.lastIndexOf("[") > prefix.lastIndexOf("]");
  const closesLinkAfterMatch = /^\**\]\(/.test(
    source.slice(offset + match.length),
  );
  return (
    insideLinkLabel &&
    closesLinkAfterMatch
  );
}

/** Add safe in-app Markdown links to navigation CTAs emitted by the assistant. */
export function linkChatNavigationCtas(markdown: string): string {
  let fenced = false;
  return markdown
    .split("\n")
    .map((line) => {
      if (line.trimStart().startsWith("```")) {
        fenced = !fenced;
        return line;
      }
      if (fenced) return line;

      // Require the 「」/『』 delimiters (same as the category rule below) so an
      // ordinary prose mention like "การเริ่มดวงจร…" is NOT turned into a link
      // mid-sentence. The prompt tells the model to emit the bracketed CTA.
      let linked = line.replace(
        /[「『]เริ่มดวงจร(?:ใหม่)?[」』]/g,
        (match, offset: number, source: string) =>
          alreadyLinked(source, offset, match)
            ? match
            : "[**เริ่มดวงจร**](/dashboard?action=transit)",
      );

      linked = linked.replace(
        /[「『]หมวด(ตัวตน|การงาน|การเงิน|ความรัก|สุขภาพ|โชคลาภ)[」』]/g,
        (match, label: string, offset: number, source: string) => {
          if (alreadyLinked(source, offset, match)) return match;
          const slug = CATEGORY_ROUTES[label];
          return slug
            ? `[**หมวด${label}**](/dashboard?cat=${slug})`
            : match;
        },
      );
      return linked;
    })
    .join("\n");
}
