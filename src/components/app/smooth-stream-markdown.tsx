"use client";

import { memo, useEffect, useRef, useState } from "react";
import { ChatMarkdown } from "./chat-markdown";

/**
 * Reveal `content` at a steady, readable pace — even when the model (or a proxy)
 * dumps the whole answer in one chunk.
 *
 * The pace is measured in CHARACTERS PER SECOND, not characters per frame. The
 * previous version added a fixed step every animation frame, which meant the
 * typing speed was whatever the display happened to be: a 120Hz laptop typed at
 * literally double the speed of a 60Hz one. It also stepped the rate through
 * hard thresholds (16 → 8 → 4 → 2 chars/frame), so the text visibly lurched as
 * the buffer drained. Rate now varies continuously with how far behind we are,
 * so it leans forward when the model is ahead and eases off as it catches up —
 * which is what "smooth" actually means here.
 *
 * Critical: when streaming ends we must NOT snap to the full text. Keep typing
 * (faster) until the reveal lands, then drop the caret.
 *
 * Only the live streaming turn animates. Settled messages (history, cache
 * restores, poll refreshes) render in full immediately — animating them
 * collapsed every bubble to zero height on mount, which threw the scroll to the
 * top of the thread and re-typed the entire history.
 */

/** Floor: slow enough to read, fast enough not to feel like it is stalling. */
const MIN_CHARS_PER_SEC = 70;
/** Ceiling: a big backlog must never turn into a wall of text appearing at once. */
const MAX_CHARS_PER_SEC = 900;
/** Each character still buffered adds this much speed — the catch-up gradient. */
const CATCHUP_PER_CHAR = 3;
/** The model is done; land the remaining text promptly without teleporting. */
const FINISH_CHARS_PER_SEC = 1500;
/** A backgrounded tab pauses rAF; clamp the jump so it doesn't teleport on return. */
const MAX_FRAME_SECONDS = 0.05;

function revealRate(remaining: number, streaming: boolean): number {
  if (!streaming) return FINISH_CHARS_PER_SEC;
  return Math.min(
    MAX_CHARS_PER_SEC,
    MIN_CHARS_PER_SEC + remaining * CATCHUP_PER_CHAR,
  );
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

export const SmoothStreamMarkdown = memo(function SmoothStreamMarkdown({
  content,
  streaming,
}: {
  content: string;
  streaming: boolean;
}) {
  const [shown, setShown] = useState(() => (streaming ? "" : content));
  const [caughtUp, setCaughtUp] = useState(true);
  const shownLenRef = useRef(streaming ? 0 : content.length);
  const contentRef = useRef(content);
  const streamingRef = useRef(streaming);

  useEffect(() => {
    contentRef.current = content;
    streamingRef.current = streaming;
  }, [content, streaming]);

  useEffect(() => {
    let alive = true;
    let raf = 0;

    const settle = (text: string) => {
      shownLenRef.current = text.length;
      setShown(text);
      setCaughtUp(true);
    };

    if (!content) {
      // Defer so we don't sync-setState in the effect body (React Compiler lint).
      raf = requestAnimationFrame(() => {
        if (alive) settle("");
      });
      return () => {
        alive = false;
        cancelAnimationFrame(raf);
      };
    }

    let cursor = shownLenRef.current;
    // Content replaced (a regenerated answer) — start over.
    if (cursor > content.length) cursor = 0;

    // Already caught up, or the user asked for no motion: show it and stop.
    if (cursor >= content.length || prefersReducedMotion()) {
      raf = requestAnimationFrame(() => {
        if (alive) settle(contentRef.current);
      });
      return () => {
        alive = false;
        cancelAnimationFrame(raf);
      };
    }

    // Fractional characters carry across frames, so a slow rate still advances
    // smoothly instead of rounding down to zero forever.
    let carry = 0;
    let lastTs = 0;

    const tick = (ts: number) => {
      if (!alive) return;
      const dt = lastTs
        ? Math.min((ts - lastTs) / 1000, MAX_FRAME_SECONDS)
        : 0;
      lastTs = ts;

      const next = contentRef.current;
      const remaining = next.length - cursor;

      if (remaining <= 0) {
        settle(next);
        return;
      }

      carry += revealRate(remaining, streamingRef.current) * dt;
      const step = Math.floor(carry);
      if (step > 0) {
        carry -= step;
        cursor = Math.min(next.length, cursor + step);
        shownLenRef.current = cursor;
        setShown(next.slice(0, cursor));
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame((ts) => {
      if (!alive) return;
      setCaughtUp(false);
      tick(ts);
    });
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, [content, streaming]);

  if (!content && streaming) return null;

  // The caret belongs to the REVEAL, not the network: it stays while the
  // typewriter is still landing text the model already finished sending.
  const stillTyping = streaming || !caughtUp;
  return <ChatMarkdown content={shown} streaming={stillTyping} />;
});
