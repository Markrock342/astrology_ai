"use client";

import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { useEffect, useRef } from "react";
import { isTurnstileEnabled, TURNSTILE_SITE_KEY } from "@/config/turnstile";

type TurnstileFieldProps = {
  onToken: (token: string) => void;
  onExpire?: () => void;
  /**
   * Bump after a submit the server refused: a token is single-use, so the
   * retry sent a spent one and failed "ยืนยันว่าไม่ใช่บอท" until a reload.
   */
  resetKey?: number;
};

/** Cloudflare Turnstile widget. Hidden when site key is not configured (local dev). */
export function TurnstileField({ onToken, onExpire, resetKey = 0 }: TurnstileFieldProps) {
  const ref = useRef<TurnstileInstance | null>(null);
  useEffect(() => {
    if (resetKey > 0) ref.current?.reset();
  }, [resetKey]);

  if (!isTurnstileEnabled) return null;

  return (
    <div className="flex justify-center py-1">
      <Turnstile
        ref={ref}
        siteKey={TURNSTILE_SITE_KEY}
        onSuccess={onToken}
        onExpire={() => {
          ref.current?.reset();
          onExpire?.();
        }}
        options={{ theme: "dark", size: "flexible" }}
      />
    </div>
  );
}

export function turnstileRequired(): boolean {
  return isTurnstileEnabled;
}
