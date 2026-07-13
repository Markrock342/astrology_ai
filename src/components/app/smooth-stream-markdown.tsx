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
      // Readable typing speed for Thai (~100–200 chars/sec).
      const step =
        remaining > 240 ? 10 : remaining > 80 ? 5 : remaining > 24 ? 3 : 1;
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
  }, [content]);

  if (!content && streaming) return null;

  const stillTyping = streaming || !caughtUp;
  return <ChatMarkdown content={shown} streaming={stillTyping} />;
}
