import type { ReactNode } from "react";

/**
 * Tiny server-safe markdown: **bold**, [text](url), and newlines → <br>.
 * No HTML passthrough — only plain text tokens.
 */
export function SimpleMarkdown({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const lines = text.split(/\n/);
  return (
    <span className={className}>
      {lines.map((line, i) => (
        <span key={i}>
          {i > 0 ? <br /> : null}
          {renderInline(line)}
        </span>
      ))}
    </span>
  );
}

function renderInline(line: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  // Match **bold** or [label](url) — leftmost first.
  const re = /(\*\*([^*]+)\*\*)|(\[([^\]]+)\]\(([^)\s]+)\))/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = re.exec(line)) !== null) {
    if (match.index > last) {
      nodes.push(line.slice(last, match.index));
    }
    if (match[1]) {
      nodes.push(<strong key={key++}>{match[2]}</strong>);
    } else if (match[3]) {
      const href = sanitizeHref(match[5] ?? "");
      const label = match[4] ?? "";
      if (href) {
        nodes.push(
          <a
            key={key++}
            href={href}
            className="text-[var(--primary)] underline-offset-2 hover:underline"
            {...(href.startsWith("http")
              ? { target: "_blank", rel: "noopener noreferrer" }
              : {})}
          >
            {label}
          </a>,
        );
      } else {
        nodes.push(label);
      }
    }
    last = match.index + match[0].length;
  }

  if (last < line.length) {
    nodes.push(line.slice(last));
  }
  return nodes;
}

/** Allow http(s), mailto, and same-origin relative paths only. */
function sanitizeHref(raw: string): string | null {
  const href = raw.trim();
  if (!href) return null;
  if (href.startsWith("/") && !href.startsWith("//")) return href;
  if (href.startsWith("mailto:") && !href.includes("javascript:")) return href;
  try {
    const u = new URL(href);
    if (u.protocol === "http:" || u.protocol === "https:") return href;
  } catch {
    return null;
  }
  return null;
}
