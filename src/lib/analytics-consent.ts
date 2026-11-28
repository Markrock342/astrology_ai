/**
 * The visitor's answer to the analytics cookie banner (PDPA: analytics cookies
 * need consent first). Kept in localStorage; no answer means "not yet asked",
 * and Google Analytics stays in Consent Mode "denied" until "granted".
 */

export type AnalyticsConsent = "granted" | "denied";

export const ANALYTICS_CONSENT_KEY = "hora-analytics-consent";
/** Fired on window when the choice changes, or when the footer link asks to reopen the banner. */
export const ANALYTICS_CONSENT_EVENT = "hora-analytics-consent";
export const OPEN_COOKIE_SETTINGS_EVENT = "hora-open-cookie-settings";

/** A GA4 measurement id; anything else leaves analytics off. */
export function validGaId(id: string | undefined | null): string | null {
  const v = (id ?? "").trim();
  return /^G-[A-Z0-9]{4,20}$/.test(v) ? v : null;
}

export function readAnalyticsConsent(): AnalyticsConsent | null {
  try {
    const v = localStorage.getItem(ANALYTICS_CONSENT_KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null;
  }
}

export function writeAnalyticsConsent(value: AnalyticsConsent): void {
  try {
    localStorage.setItem(ANALYTICS_CONSENT_KEY, value);
  } catch {
    // Private mode: the choice holds for this page view only.
  }
  window.dispatchEvent(new CustomEvent(ANALYTICS_CONSENT_EVENT, { detail: value }));
}

export function openCookieSettings(): void {
  window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS_EVENT));
}

/**
 * What GA may see of a URL: the path only. Query strings carry reset and
 * verification tokens (/reset-password?token=…), and admin pages are not
 * the audience we measure.
 */
export function analyticsPagePath(pathname: string): string | null {
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return null;
  return pathname || "/";
}

/** Remove GA's own cookies (_ga, _ga_XXXX) after a visitor withdraws consent. */
export function clearGaCookies(): void {
  const host = location.hostname;
  const domains = ["", host, `.${host}`, `.${host.split(".").slice(-2).join(".")}`];
  for (const raw of document.cookie.split(";")) {
    const name = raw.split("=")[0]?.trim();
    if (!name || !(name === "_ga" || name.startsWith("_ga_"))) continue;
    for (const d of domains) {
      document.cookie = `${name}=; Max-Age=0; path=/${d ? `; domain=${d}` : ""}`;
    }
  }
}
