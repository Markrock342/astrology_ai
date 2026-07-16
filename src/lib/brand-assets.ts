import type { CmsSiteTheme } from "@/lib/cms-keys";

export const DEFAULT_BRAND_MARK = "/logo.png";
export const DEFAULT_BRAND_WORDMARK = "/wordmark.png";

/** Resolve CMS logo URLs with static fallbacks. Pure — safe for tests & SSR. */
export function resolveBrandUrls(theme: CmsSiteTheme): {
  markUrl: string;
  wordmarkUrl: string;
} {
  return {
    markUrl: theme.markUrl?.trim() || DEFAULT_BRAND_MARK,
    wordmarkUrl: theme.wordmarkUrl?.trim() || DEFAULT_BRAND_WORDMARK,
  };
}
