"use client";

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter((el) => !el.hasAttribute("disabled"));
}

/**
 * One focus contract for every dialog in the app (WCAG 2.1.1 / 2.4.3):
 *
 *  - remembers the element that opened the dialog and hands focus back on close
 *  - moves focus inside on open (an `autoFocus` child wins, then
 *    `initialFocusRef`, then the first focusable, then the dialog itself)
 *  - Escape closes unless `busy` (a save is in flight)
 *  - Tab / Shift+Tab wrap inside the dialog, and focus that escaped to the page
 *    behind the overlay is pulled back in
 *  - body scroll is locked while open
 *
 * ConfirmModal, the settings modals, the transit form and both chart lightboxes
 * used to each carry their own copy of a subset of this — the ones that
 * forgot Escape or the trap were exactly the ones an audit flagged.
 */
export function useDialogFocus({
  open,
  dialogRef,
  onClose,
  initialFocusRef,
  busy = false,
  selectInitial = false,
}: {
  open: boolean;
  dialogRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  initialFocusRef?: RefObject<HTMLElement | null>;
  busy?: boolean;
  /** Select the text of the initially focused input (rename dialogs). */
  selectInitial?: boolean;
}) {
  const onCloseRef = useRef(onClose);
  const busyRef = useRef(busy);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  useEffect(() => {
    if (!open) return;

    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Portals commit their content in the same tick, but an autoFocus'd input
    // only owns focus after the browser has run its autofocus step.
    const timer = window.setTimeout(() => {
      const dialog = dialogRef.current;
      if (!dialog) return;
      if (dialog.contains(document.activeElement)) return;
      const target =
        initialFocusRef?.current ?? getFocusable(dialog)[0] ?? dialog;
      target.focus();
      if (selectInitial && target instanceof HTMLInputElement) target.select();
    }, 0);

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (busyRef.current) return;
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const nodes = getFocusable(dialog);
      if (nodes.length === 0) {
        e.preventDefault();
        dialog.focus();
        return;
      }
      const first = nodes[0]!;
      const last = nodes[nodes.length - 1]!;
      const active = document.activeElement;
      const outside = !dialog.contains(active);
      if (e.shiftKey && (active === first || outside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || outside)) {
        e.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [open, dialogRef, initialFocusRef, selectInitial]);
}
