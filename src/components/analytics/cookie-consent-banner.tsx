"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  ANALYTICS_CONSENT_EVENT,
  OPEN_COOKIE_SETTINGS_EVENT,
  openCookieSettings,
  readAnalyticsConsent,
  writeAnalyticsConsent,
  type AnalyticsConsent,
} from "@/lib/analytics-consent";

/**
 * Analytics cookie banner. Pattern from the GOV.UK Design System cookie
 * banner (govuk-frontend, MIT): a plain question, Accept and Reject as equal
 * buttons, a link to the policy, a confirmation line after answering, and a
 * footer link to change the answer later. Styled with the site's own tokens.
 */
function subscribeConsent(onChange: () => void) {
  window.addEventListener(ANALYTICS_CONSENT_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(ANALYTICS_CONSENT_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

// "unknown" on the server and during hydration: the banner never flashes for
// a visitor who already answered.
const consentSnapshot = (): AnalyticsConsent | "unasked" => readAnalyticsConsent() ?? "unasked";
const serverConsentSnapshot = (): "unknown" => "unknown";

type Mode = "auto" | "asking" | "confirm" | "closed";

export function CookieConsentBanner() {
  const stored = useSyncExternalStore(subscribeConsent, consentSnapshot, serverConsentSnapshot);
  const [mode, setMode] = useState<Mode>("auto");
  const [answered, setAnswered] = useState<AnalyticsConsent | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const reopen = () => {
      setMode("asking");
      requestAnimationFrame(() => headingRef.current?.focus());
    };
    window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, reopen);
    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, reopen);
  }, []);

  useEffect(() => {
    if (mode !== "confirm") return;
    const t = setTimeout(() => setMode("closed"), 4000);
    return () => clearTimeout(t);
  }, [mode]);

  const visible = mode === "asking" || mode === "confirm" || (mode === "auto" && stored === "unasked");
  if (!visible) return null;

  const choose = (value: AnalyticsConsent) => {
    writeAnalyticsConsent(value);
    setAnswered(value);
    setMode("confirm");
  };

  return (
    <section
      role="region"
      aria-label="การใช้คุกกี้บนเว็บไซต์"
      className="fixed inset-x-0 bottom-0 z-[60] px-4 pb-4 sm:px-6"
    >
      <div className="mx-auto max-w-3xl rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
        {mode === "confirm" && answered ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" role="status">
            <p className="text-sm text-[var(--foreground)]">
              {answered === "granted"
                ? "คุณยอมรับคุกกี้วิเคราะห์การใช้งานแล้ว"
                : "คุณปฏิเสธคุกกี้วิเคราะห์การใช้งานแล้ว"}{" "}
              เปลี่ยนได้ทุกเมื่อที่ลิงก์ &ldquo;ตั้งค่าคุกกี้&rdquo; ท้ายหน้า
            </p>
            <button
              type="button"
              onClick={() => setMode("closed")}
              className="press-scale shrink-0 rounded-xl border border-[var(--border-strong)] px-4 py-2 text-xs font-semibold text-[var(--foreground)] transition hover:border-[var(--primary)]"
            >
              ปิด
            </button>
          </div>
        ) : (
          <>
            <h2
              ref={headingRef}
              tabIndex={-1}
              className="text-base font-semibold text-[var(--foreground)] outline-none"
            >
              ขออนุญาตใช้คุกกี้วิเคราะห์การใช้งาน
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
              คุกกี้ที่จำเป็นช่วยให้เว็บไซต์ทำงานและเก็บการเข้าสู่ระบบของคุณ
              ส่วนคุกกี้วิเคราะห์ (Google Analytics) ช่วยให้เรารู้ว่าหน้าไหนมีคนใช้มาก
              เพื่อนำไปปรับปรุงเว็บไซต์ โดยไม่ส่งข้อมูลวันเดือนปีเกิดหรือข้อความแชตของคุณ{" "}
              <Link href="/privacy" className="font-medium text-[var(--primary)] underline underline-offset-2">
                อ่านนโยบายความเป็นส่วนตัว
              </Link>
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => choose("granted")}
                className="press-scale rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] transition hover:bg-[var(--primary-hover)]"
              >
                ยอมรับคุกกี้วิเคราะห์
              </button>
              <button
                type="button"
                onClick={() => choose("denied")}
                className="press-scale rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] transition hover:bg-[var(--primary-hover)]"
              >
                ปฏิเสธคุกกี้วิเคราะห์
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

/** Footer link that reopens the banner. */
export function CookieSettingsLink({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={openCookieSettings}
      className={className}
    >
      ตั้งค่าคุกกี้
    </button>
  );
}
