export const OPEN_TRANSIT_EVENT = "horasard:open-transit";

const CATEGORY_ROUTES: Record<string, string> = {
  ตัวตน: "self",
  การงาน: "career",
  การเงิน: "finance",
  ความรัก: "love",
  สุขภาพ: "health",
  โชคลาภ: "fortune",
};

const CATEGORY_LABELS = "ตัวตน|การงาน|การเงิน|ความรัก|สุขภาพ|โชคลาภ";

export type TransitOpenDetail = { categorySlug?: string | null };

export function natalCategoryHref(slug: string): string {
  return `/dashboard?cat=${encodeURIComponent(slug)}`;
}

/** Empty-state home: pick a category, then open the transit form. */
export function transitCategoryHref(slug: string): string {
  return `/dashboard?action=transit&cat=${encodeURIComponent(slug)}`;
}

export function parseDashboardChatHref(href: string): {
  isDashboard: boolean;
  action: string | null;
  cat: string | null;
} {
  try {
    const url = new URL(href, "https://horasard.local");
    return {
      isDashboard: url.pathname === "/dashboard",
      action: url.searchParams.get("action"),
      cat: url.searchParams.get("cat"),
    };
  } catch {
    return { isDashboard: false, action: null, cat: null };
  }
}

/** Map Thai category labels (with optional หมวด / markdown bold) to a slug. */
export function categorySlugFromLabel(text: string): string | null {
  const trimmed = text.replace(/\s+/g, "").replace(/^\*{1,2}|\*{1,2}$/g, "");
  const withoutPrefix = trimmed.replace(/^หมวด/, "");
  return CATEGORY_ROUTES[withoutPrefix] ?? CATEGORY_ROUTES[trimmed] ?? null;
}

export function dispatchOpenTransit(categorySlug?: string | null) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<TransitOpenDetail>(OPEN_TRANSIT_EVENT, {
      detail: { categorySlug: categorySlug ?? undefined },
    }),
  );
}

export function readOpenTransitDetail(event: Event): string | null {
  if (!(event instanceof CustomEvent)) return null;
  const slug = (event.detail as TransitOpenDetail | undefined)?.categorySlug;
  return typeof slug === "string" && slug.length > 0 ? slug : null;
}

function alreadyLinked(source: string, offset: number, match: string): boolean {
  const prefix = source.slice(0, offset);
  const insideLinkLabel = prefix.lastIndexOf("[") > prefix.lastIndexOf("]");
  const closesLinkAfterMatch = /^\**\]\(/.test(
    source.slice(offset + match.length),
  );
  return insideLinkLabel && closesLinkAfterMatch;
}

function fillMissingCategoryInMarkdownLinks(line: string): string {
  const pattern = new RegExp(
    `\\[(\\*{0,2}(?:หมวด)?(?:${CATEGORY_LABELS})\\*{0,2})\\]\\((\\/dashboard(?:\\?[^\\s)]*)?)\\)`,
    "g",
  );
  return line.replace(pattern, (match, label: string, href: string) => {
    const parsed = parseDashboardChatHref(href);
    if (!parsed.isDashboard || parsed.action === "transit" || parsed.cat) {
      return match;
    }
    const slug = categorySlugFromLabel(label);
    return slug ? `[${label}](${natalCategoryHref(slug)})` : match;
  });
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
            ? `[**หมวด${label}**](${natalCategoryHref(slug)})`
            : match;
        },
      );

      linked = linked.replace(
        /[「『](ตัวตน|การงาน|การเงิน|ความรัก|สุขภาพ|โชคลาภ)[」』]/g,
        (match, label: string, offset: number, source: string) => {
          if (alreadyLinked(source, offset, match)) return match;
          const slug = CATEGORY_ROUTES[label];
          return slug ? `[**${label}**](${natalCategoryHref(slug)})` : match;
        },
      );

      return fillMissingCategoryInMarkdownLinks(linked);
    })
    .join("\n");
}
