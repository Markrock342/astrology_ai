/** Public Turnstile site key (browser). Empty = widget hidden, server skips verify in dev. */
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

export const isTurnstileEnabled = TURNSTILE_SITE_KEY.length > 0;
