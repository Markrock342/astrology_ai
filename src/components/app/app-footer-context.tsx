"use client";

import { createContext, useContext } from "react";
import type { CmsSiteFooter } from "@/lib/cms-keys";

/**
 * The CMS site footer, handed from the app shell down to whichever view owns
 * the scrolling content (the chat). It renders the footer at the very end of
 * its own scroll area, so the footer is only reached after every message /
 * every table has been scrolled past — never over the composer, never on first
 * paint.
 */
export const AppFooterContext = createContext<CmsSiteFooter | null>(null);

export function useAppFooter(): CmsSiteFooter | null {
  return useContext(AppFooterContext);
}
