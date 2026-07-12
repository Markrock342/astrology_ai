"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { confirmLeave } from "./form-utils";

/**
 * Shared draft editor state for CMS content screens.
 * - tracks dirty flag
 * - beforeunload + confirm when switching
 * - optional debounce autosave (call onAutosave)
 */
export function useContentEditor<T>(opts: {
  initial: T;
  isEqual?: (a: T, b: T) => boolean;
  /** Called after 3s of idle dirty state (optional). */
  onAutosave?: (draft: T) => Promise<void>;
}) {
  const [draft, setDraft] = useState<T>(opts.initial);
  const [baseline, setBaseline] = useState<T>(opts.initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<"draft" | "publish" | null>(null);
  const equal = opts.isEqual ?? ((a, b) => JSON.stringify(a) === JSON.stringify(b));
  const dirty = !equal(draft, baseline);
  const autosaveRef = useRef(opts.onAutosave);

  useEffect(() => {
    autosaveRef.current = opts.onAutosave;
  }, [opts.onAutosave]);

  const reset = useCallback((next: T) => {
    setDraft(next);
    setBaseline(next);
    setError(null);
    setSaved(null);
  }, []);

  const markSaved = useCallback(
    (mode: "draft" | "publish", next?: T) => {
      const value = next ?? draft;
      setDraft(value);
      setBaseline(value);
      setSaved(mode);
      setError(null);
    },
    [draft],
  );

  const tryLeave = useCallback(
    (message?: string) => {
      if (!dirty) return true;
      return confirmLeave(message);
    },
    [dirty],
  );

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    if (!dirty || !autosaveRef.current) return;
    const t = window.setTimeout(() => {
      void autosaveRef.current?.(draft).catch(() => {
        /* ignore autosave errors — explicit save still available */
      });
    }, 3000);
    return () => window.clearTimeout(t);
  }, [dirty, draft]);

  return {
    draft,
    setDraft,
    baseline,
    dirty,
    busy,
    setBusy,
    error,
    setError,
    saved,
    setSaved,
    reset,
    markSaved,
    tryLeave,
  };
}
