"use client";

import { useEffect, useState } from "react";
import { ChatMarkdown } from "./chat-markdown";

/**
 * Reveal streamed text smoothly even when the model dumps large chunks.
 * Feels like ChatGPT typing instead of a sudden paragraph dump.
 */
export function SmoothStreamMarkdown({
  content,
  streaming,
}: {
  content: string;
  streaming: boolean;
}) {
  const [shown, setShown] = useState(content);

  useEffect(() => {
    if (!streaming) {
      setShown(content);
      return;
    }
    if (content.length <= shown.length) {
      setShown(content);
      return;
    }

    let alive = true;
    let cursor = shown.length;
    const target = content;

    const tick = () => {
      if (!alive) return;
      // Catch up faster when far behind, still visible as typing.
      const remaining = target.length - cursor;
      const step = remaining > 80 ? 12 : remaining > 30 ? 5 : 2;
      cursor = Math.min(target.length, cursor + step);
      setShown(target.slice(0, cursor));
      if (cursor < target.length) {
        requestAnimationFrame(tick);
      }
    };
    const id = requestAnimationFrame(tick);
    return () => {
      alive = false;
      cancelAnimationFrame(id);
    };
    // Only re-drive when content grows or streaming flips.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, streaming]);

  if (!content && streaming) {
    return null;
  }

  return <ChatMarkdown content={shown} streaming={streaming} />;
}
