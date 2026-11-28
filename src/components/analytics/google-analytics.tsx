"use client";

import { useEffect } from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";
import {
  ANALYTICS_CONSENT_EVENT,
  analyticsPagePath,
  clearGaCookies,
  readAnalyticsConsent,
  type AnalyticsConsent,
} from "@/lib/analytics-consent";

type Gtag = (...args: unknown[]) => void;
declare global {
  interface Window {
    gtag?: Gtag;
    dataLayer?: unknown[];
  }
}

/**
 * Queue-only gtag + Consent Mode v2 defaults. Commands wait in dataLayer
 * until gtag.js loads, so it does not matter which arrives first.
 */
function bootGtag(gaId: string): Gtag {
  if (window.gtag) return window.gtag;
  window.dataLayer = window.dataLayer || [];
  const gtag: Gtag = function () {
    // gtag.js reads the Arguments object, not an array.
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  window.gtag = gtag;
  gtag("consent", "default", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: readAnalyticsConsent() === "granted" ? "granted" : "denied",
  });
  gtag("set", "ads_data_redaction", true);
  gtag("js", new Date());
  gtag("config", gaId, {
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });
  return gtag;
}

// One hit per navigation: StrictMode and re-renders run the effect again for
// the same path.
let lastSentPath: string | null = null;

function sendPageView(gtag: Gtag, pathname: string) {
  const path = analyticsPagePath(pathname);
  if (!path || path === lastSentPath) return;
  lastSentPath = path;
  gtag("event", "page_view", {
    page_location: `${location.origin}${path}`,
    page_path: path,
    page_title: document.title,
  });
}

/**
 * GA4 with Consent Mode v2: everything starts "denied", so gtag.js sets no
 * cookie until the visitor accepts in the banner. Page views carry the path
 * only (query strings can hold reset tokens) and skip /admin. No birth data,
 * chat text or account details are sent.
 */
export function GoogleAnalytics({ gaId }: { gaId: string }) {
  const pathname = usePathname();

  useEffect(() => {
    sendPageView(bootGtag(gaId), pathname ?? "/");
  }, [gaId, pathname]);

  useEffect(() => {
    const onChange = (e: Event) => {
      const value = (e as CustomEvent<AnalyticsConsent>).detail;
      // The page view already went out (cookieless while denied); a second
      // one here would count this page twice.
      bootGtag(gaId)("consent", "update", { analytics_storage: value });
      if (value === "denied") clearGaCookies();
    };
    window.addEventListener(ANALYTICS_CONSENT_EVENT, onChange);
    return () => window.removeEventListener(ANALYTICS_CONSENT_EVENT, onChange);
  }, [gaId]);

  return (
    <Script
      id="ga-gtag"
      strategy="afterInteractive"
      src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`}
    />
  );
}
