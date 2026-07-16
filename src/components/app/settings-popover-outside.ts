/** Shared marker for SettingsPopover roots (mobile may mount two at once). */
export const SETTINGS_POPOVER_ATTR = "data-settings-popover";

type ClosestTarget = {
  closest: (selector: string) => Element | null;
};

/**
 * Pure close-decision used by the document pointerdown handler.
 * Split out so dual-mount mobile (visible + hidden popover) can be unit-tested
 * without a DOM environment.
 */
export function shouldCloseSettingsPopover(
  target: ClosestTarget | null,
  opts: { inOwnPopover: boolean; inAnchor: boolean },
): boolean {
  if (opts.inAnchor) return false;
  if (target?.closest(`[${SETTINGS_POPOVER_ATTR}]`)) return false;
  if (opts.inOwnPopover) return false;
  return true;
}

/**
 * True when a pointerdown should close this popover.
 *
 * Mobile mounts the sidebar twice (drawer + CSS-hidden desktop aside), so two
 * popovers each attach a document listener. A tap inside the *visible* menu is
 * outside the *hidden* instance's ref — without the shared attribute check the
 * hidden twin closes both before click / router.push can run.
 */
export function isOutsideSettingsPopover(
  target: EventTarget | null,
  opts: {
    popoverEl: HTMLElement | null;
    anchorEl?: HTMLElement | null;
  },
): boolean {
  if (!(target instanceof Node)) return true;
  const el = target instanceof Element ? target : null;
  return shouldCloseSettingsPopover(el, {
    inOwnPopover: Boolean(opts.popoverEl?.contains(target)),
    inAnchor: Boolean(opts.anchorEl?.contains(target)),
  });
}
