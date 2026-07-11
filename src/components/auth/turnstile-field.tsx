"use client";

import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { useRef } from "react";
import { isTurnstileEnabled, TURNSTILE_SITE_KEY } from "@/config/turnstile";

type TurnstileFieldProps = {
  onToken: (token: string) => void;
  onExpire?: () => void;
};

/** Cloudflare Turnstile widget. Hidden when site key is not configured (local dev). */
export function TurnstileField({ onToken, onExpire }: TurnstileFieldProps) {
  const ref = useRef<TurnstileInstance | null>(null);

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
