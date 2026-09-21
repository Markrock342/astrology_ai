"use client";

import { memo, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CopyCodeButton } from "./copy-code-button";
import { completeMarkdown } from "./complete-markdown";
import { handleDashboardChatLinkClick } from "./chat-nav";
import { linkChatNavigationCtas } from "@/lib/chat-navigation-links";

const components: Components = {
  h1: ({ children }) => (
    <h1 className="mb-3 mt-6 text-[1.35rem] font-semibold tracking-tight text-[var(--foreground)] first:mt-0 sm:text-2xl">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-2.5 mt-5 text-lg font-semibold tracking-tight text-[var(--foreground)] first:mt-0 sm:text-xl">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-2 mt-4 text-base font-semibold text-[var(--foreground)] first:mt-0">
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className="mb-1.5 mt-3 text-sm font-semibold text-[var(--foreground)] first:mt-0">
      {children}
    </h4>
  ),
  p: ({ children }) => (
    <p className="mb-3 text-[15px] leading-7 text-[var(--foreground)] last:mb-0">
      {children}
    </p>
  ),
  ul: ({ children }) => (
    <ul className="mb-3 list-disc space-y-1.5 pl-5 text-[15px] leading-7 text-[var(--foreground)] last:mb-0">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-3 list-decimal space-y-1.5 pl-5 text-[15px] leading-7 text-[var(--foreground)] last:mb-0">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="pl-0.5 marker:text-[var(--primary)]">{children}</li>,
  strong: ({ children }) => (
    <strong className="font-semibold text-[var(--foreground)]">{children}</strong>
  ),
  em: ({ children }) => <em className="italic text-[var(--muted)]">{children}</em>,
  a: ({ href, children }) => {
    const safe = sanitizeHref(href ?? "");
    if (!safe) return <span>{children}</span>;
    const external = safe.startsWith("http");
    const className =
      "font-semibold text-[var(--primary)] underline decoration-[var(--primary)]/70 underline-offset-2 transition hover:text-[var(--primary-hover)]";
    if (!external) {
      return (
        <Link
          href={safe}
          className={className}
          onClick={(event) => {
            handleDashboardChatLinkClick(
              event,
              safe,
              reactNodeText(children),
            );
          }}
        >
          {children}
        </Link>
      );
    }
    return (
      <a
        href={safe}
        className={className}
        target="_blank"
        rel="noopener noreferrer"
      >
        {children}
      </a>
    );
  },
  blockquote: ({ children }) => (
    <blockquote className="mb-3 border-l-2 border-[var(--primary)]/50 bg-[var(--surface-2)]/60 py-1 pl-3 pr-2 text-[15px] leading-7 text-[var(--muted)] last:mb-0">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-5 border-0 border-t border-[var(--border)]" />,
  code: ({ className, children }) => {
    const isBlock = Boolean(className?.includes("language-"));
    if (isBlock) {
      return (
        <code className="font-mono text-[13px] leading-6 text-[var(--foreground)]">
          {children}
        </code>
      );
    }
    return (
      <code className="rounded-md bg-[var(--surface-3)] px-1.5 py-0.5 font-mono text-[13px] text-[var(--primary)]">
        {children}
      </code>
    );
  },
  pre: ({ children }) => {
    const child = Array.isArray(children) ? children[0] : children;
    const codeText =
      child &&
      typeof child === "object" &&
      "props" in child &&
      typeof child.props?.children === "string"
        ? child.props.children
        : "";
    return (
      <div className="group/code relative mb-3 last:mb-0">
        {codeText ? (
          <div className="absolute right-2 top-2 z-10 transition md:opacity-0 md:group-hover/code:opacity-100 md:group-focus-within/code:opacity-100">
            <CopyCodeButton code={codeText} />
          </div>
        ) : null}
        <pre className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-3 pt-8">
          {children}
        </pre>
      </div>
    );
  },
  table: ({ children }) => (
    <div className="mb-4 overflow-x-auto rounded-2xl border border-[var(--border)] last:mb-0">
      <table className="min-w-full border-collapse text-left text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-[var(--surface-2)] text-[var(--muted)]">{children}</thead>
  ),
  tbody: ({ children }) => <tbody className="divide-y divide-[var(--border)]">{children}</tbody>,
  tr: ({ children }) => <tr className="border-b border-[var(--border)] last:border-0">{children}</tr>,
  th: ({ children }) => (
    <th className="whitespace-nowrap px-3 py-2.5 text-xs font-semibold uppercase tracking-wide">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2.5 align-top text-[14px] leading-6 text-[var(--foreground)]">
      {children}
    </td>
  ),
};

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

function reactNodeText(node: unknown): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(reactNodeText).join("");
  if (
    typeof node === "object" &&
    "props" in node &&
    typeof (node as { props?: { children?: unknown } }).props === "object"
  ) {
    return reactNodeText(
      (node as { props?: { children?: unknown } }).props?.children,
    );
  }
  return "";
}

const REMARK_PLUGINS = [remarkGfm];

/**
 * Gemini sometimes writes `<br>` inside table cells (there is no line break
 * in GFM cells). react-markdown renders raw HTML as literal text, so the tag
 * showed up in the answer. A separator reads the way the model meant it.
 */
export function stripHtmlBreaks(markdown: string): string {
  return markdown.replace(/\s*<br\s*\/?>\s*/gi, " · ");
}

/** One parsed run of blocks. Memoized so a settled `source` never re-parses. */
const MarkdownBlocks = memo(function MarkdownBlocks({ source }: { source: string }) {
  return (
    <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={components}>
      {source}
    </ReactMarkdown>
  );
});

/** A line that must stay with the block before it if that block is the same kind. */
const CONTINUATION_LINE = /^(\s{2,}\S|\s*([-*+]|\d+[.)])\s|\s*\||\s*>)/;

function lastLine(text: string): string {
  return text.slice(text.lastIndexOf("\n") + 1);
}

/**
 * Largest cut ≤ text.length at a blank line such that text[0:cut] is a
 * self-contained run of blocks: no open code fence, and the cut does not fall
 * between two list items / table rows / quote lines (splitting those would
 * restart numbering or break the table). Returns 0 when nothing is stable yet.
 */
export function stableBlockBoundary(text: string): number {
  let idx = text.lastIndexOf("\n\n");
  while (idx > 0) {
    const head = text.slice(0, idx);
    const fences = head.match(/^\s*(```|~~~)/gm)?.length ?? 0;
    const rest = text.slice(idx + 2);
    const splitsBlock =
      CONTINUATION_LINE.test(rest) && CONTINUATION_LINE.test(lastLine(head));
    if (fences % 2 === 0 && !splitsBlock) return idx + 2;
    idx = text.lastIndexOf("\n\n", idx - 1);
  }
  return 0;
}

/**
 * GPT/Grok-style markdown for assistant chat turns (GFM: tables, lists, headings).
 *
 * Streaming cost model: the typewriter hands us a growing prefix every frame.
 * Parsing the whole prefix each time is O(answer length) per frame, so a long
 * answer got slower the closer it was to finishing. Instead the prefix is split
 * at the last stable block boundary: everything before it is parsed once
 * (memoized by string identity) and only the block still being typed is
 * re-parsed per frame. Both halves render straight into the same wrapper so
 * `.chat-md.stream-caret > :last-child` still finds the live block.
 */
export const ChatMarkdown = memo(function ChatMarkdown({
  content,
  streaming = false,
}: {
  content: string;
  streaming?: boolean;
}) {
  // A streamed answer re-renders its live tail every frame, and the tail can
  // come out SHORTER for a frame — a half-arrived table row is completed into a
  // full row, a bullet joins the list above it. On screen that reads as the
  // answer shivering up and down while the AI writes. The block is held at the
  // tallest height it has reached, so it only ever grows.
  const wrapRef = useRef<HTMLDivElement>(null);
  const [floor, setFloor] = useState(0);
  useLayoutEffect(() => {
    if (!streaming) {
      if (floor !== 0) setFloor(0);
      return;
    }
    const height = wrapRef.current?.offsetHeight ?? 0;
    // Monotonic, so this settles after one extra pass instead of looping.
    if (height > floor) setFloor(height);
  }, [streaming, floor, content]);

  if (!content) return null;

  if (!streaming) {
    const source = linkChatNavigationCtas(stripHtmlBreaks(content));
    if (!source) return null;
    return (
      <div className="chat-md max-w-none">
        <MarkdownBlocks source={source} />
      </div>
    );
  }

  // While typing, the parser is handed a PREFIX — syntactically incomplete
  // markdown, which it renders faithfully as pipe salad and stray asterisks that
  // then rearrange themselves. Complete the live tail before it gets there; the
  // head ends at a blank line and is whole by construction.
  const cleaned = stripHtmlBreaks(content);
  const cut = stableBlockBoundary(cleaned);
  const head = cut > 0 ? linkChatNavigationCtas(cleaned.slice(0, cut)) : "";
  const tail = linkChatNavigationCtas(completeMarkdown(cleaned.slice(cut)));
  if (!head && !tail) return null;

  return (
    <div
      ref={wrapRef}
      className="chat-md stream-caret max-w-none"
      data-streaming="true"
      style={floor ? { minHeight: floor } : undefined}
    >
      {head ? <MarkdownBlocks source={head} /> : null}
      {tail ? <MarkdownBlocks source={tail} /> : null}
    </div>
  );
});
