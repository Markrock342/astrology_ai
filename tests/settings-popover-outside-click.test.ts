import { describe, expect, it } from "vitest";
import {
  SETTINGS_POPOVER_ATTR,
  shouldCloseSettingsPopover,
} from "@/components/app/settings-popover-outside";

/**
 * Mobile mounts two SettingsPopovers (drawer + CSS-hidden desktop). A tap on
 * the visible menu must not count as "outside" for the hidden twin's listener.
 */
describe("shouldCloseSettingsPopover", () => {
  it("does not close when target is inside ANY settings popover (dual-mount)", () => {
    // Hidden twin: tap is not in its own tree, but closest finds the visible one.
    const targetInVisibleMenu = {
      closest: (sel: string) =>
        sel.includes(SETTINGS_POPOVER_ATTR) ? ({} as Element) : null,
    };
    expect(
      shouldCloseSettingsPopover(targetInVisibleMenu, {
        inOwnPopover: false,
        inAnchor: false,
      }),
    ).toBe(false);
  });

  it("closes when tap is outside popover and anchor", () => {
    const elsewhere = { closest: () => null };
    expect(
      shouldCloseSettingsPopover(elsewhere, {
        inOwnPopover: false,
        inAnchor: false,
      }),
    ).toBe(true);
  });

  it("does not close when tap is on the profile anchor", () => {
    expect(
      shouldCloseSettingsPopover(
        { closest: () => null },
        {
          inOwnPopover: false,
          inAnchor: true,
        },
      ),
    ).toBe(false);
  });

  it("does not close when tap is inside its own popover", () => {
    expect(
      shouldCloseSettingsPopover(
        { closest: () => null },
        {
          inOwnPopover: true,
          inAnchor: false,
        },
      ),
    ).toBe(false);
  });
});
