"use client";

import { memo } from "react";
import Link from "next/link";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CopyCodeButton } from "./copy-code-button";
import { completeMarkdown } from "./complete-markdown";
import {
  linkChatNavigationCtas,
  OPEN_TRANSIT_EVENT,
} from "@/lib/chat-navigation-links";

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
    const opensTransit = safe === "/dashboard?action=transit";
    const className =
      "font-semibold text-[var(--primary)] underline decoration-[var(--primary)]/70 underline-offset-2 transition hover:text-[var(--primary-hover)]";
    if (!external) {
      return (
        <Link
          href={safe}
          className={className}
          onClick={
            opensTransit
              ? (event) => {
                  event.preventDefault();
                  window.dispatchEvent(new Event(OPEN_TRANSIT_EVENT));
                }
              : undefined
          }
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
          <div className="absolute right-2 top-2 z-10 opacity-0 transition group-hover/code:opacity-100">
            <CopyCodeButton code={codeText} />
          </div>
        ) : null}
        <pre className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3 pt-8">
          {children}
        </pre>
      </div>
    );
  },
  table: ({ children }) => (
    <div className="mb-4 overflow-x-auto rounded-xl border border-[var(--border)] last:mb-0">
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

/**
 * GPT/Grok-style markdown for assistant chat turns (GFM: tables, lists, headings).
 * Memoized: during streaming the whole message list re-renders per frame, and
 * without memo every settled message re-parsed its markdown on each tick.
 */
export const ChatMarkdown = memo(function ChatMarkdown({
  content,
  streaming = false,
}: {
  content: string;
  streaming?: boolean;
}) {
  if (!content) return null;

  // While typing, the parser is handed a PREFIX — syntactically incomplete
  // markdown, which it renders faithfully as pipe salad and stray asterisks that
  // then rearrange themselves. Complete the document before it gets there.
  // A settled message is already whole; leave it strictly alone.
  const completed = streaming ? completeMarkdown(content) : content;
  const source = linkChatNavigationCtas(completed);
  if (!source) return null;

  return (
    <div
      className={`chat-md max-w-none ${streaming ? "stream-caret" : ""}`}
      data-streaming={streaming ? "true" : undefined}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {source}
      </ReactMarkdown>
    </div>
  );
});
