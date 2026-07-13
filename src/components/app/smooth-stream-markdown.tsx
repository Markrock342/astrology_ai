"use client";

import { useEffect, useRef, useState } from "react";
import { ChatMarkdown } from "./chat-markdown";

/**
 * Always reveal toward `content` character-by-character — even when the model
 * (or the proxy) dumps the whole answer in one chunk. ChatGPT-like typing.
 *
 * Critical: when streaming ends we must NOT snap to full text. Keep typing
 * until the reveal catches up, then drop the caret.
 */
export function SmoothStreamMarkdown({
  content,
  streaming,
}: {
  content: string;
  streaming: boolean;
}) {
  const [shown, setShown] = useState("");
  const [caughtUp, setCaughtUp] = useState(true);
  const shownLenRef = useRef(0);
  const contentRef = useRef(content);
  contentRef.current = content;

  useEffect(() => {
    if (!content) {
      shownLenRef.current = 0;
      setShown("");
      setCaughtUp(true);
      return;
    }

    let alive = true;
    let cursor = shownLenRef.current;
    // Content replaced (new answer) — start from the beginning.
    if (cursor > content.length) {
      cursor = 0;
      shownLenRef.current = 0;
      setShown("");
    }

    const tick = () => {
      if (!alive) return;
      const next = contentRef.current;
      if (cursor >= next.length) {
        shownLenRef.current = next.length;
        setShown(next);
        setCaughtUp(true);
        return;
      }
      setCaughtUp(false);
      const remaining = next.length - cursor;
      // After the model finishes, catch up quickly so the full answer is visible.
      const step = streaming
        ? remaining > 240
          ? 16
          : remaining > 80
            ? 8
            : remaining > 24
              ? 4
              : 2
        : Math.min(remaining, Math.max(32, Math.ceil(remaining / 6)));
      cursor = Math.min(next.length, cursor + step);
      shownLenRef.current = cursor;
      setShown(next.slice(0, cursor));
      requestAnimationFrame(tick);
    };

    setCaughtUp(false);
    const id = requestAnimationFrame(tick);
    return () => {
      alive = false;
      cancelAnimationFrame(id);
    };
  }, [content, streaming]);

  if (!content && streaming) return null;

  const stillTyping = streaming || !caughtUp;
  return <ChatMarkdown content={shown} streaming={stillTyping} />;
}
