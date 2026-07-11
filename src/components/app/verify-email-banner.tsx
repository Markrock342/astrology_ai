"use client";

import { useState } from "react";
import { useAppData } from "./app-data-provider";
import { TurnstileField, turnstileRequired } from "@/components/auth/turnstile-field";

/** Soft email verification reminder for email/password accounts. */
export function VerifyEmailBanner() {
  const { user, refresh } = useAppData();
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(
    turnstileRequired() ? null : "",
  );
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!user?.needsEmailVerification) return null;

  async function resend(token: string | null) {
    if (turnstileRequired() && !token) {
      setShowCaptcha(true);
      setMessage("กรุณายืนยันว่าไม่ใช่บอทก่อนส่งอีเมล");
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ turnstileToken: token ?? undefined }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        data?: { sent: boolean };
        error?: { message: string };
      };
      if (!json.ok) {
        setMessage(json.error?.message ?? "ส่งอีเมลไม่สำเร็จ");
        return;
      }
      setMessage(
        json.data?.sent
          ? "ส่งลิงก์ยืนยันไปที่อีเมลของคุณแล้ว"
          : "อีเมลนี้ยืนยันแล้วหรือไม่ต้องยืนยัน",
      );
      setShowCaptcha(false);
      refresh();
    } catch {
      setMessage("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border-b border-[var(--primary)]/30 bg-[var(--surface-2)] px-4 py-3 md:px-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[var(--muted)]">
          กรุณายืนยันอีเมล{" "}
          <span className="font-medium text-[var(--foreground)]">{user.email}</span>{" "}
          เพื่อความปลอดภัยของบัญชี
        </p>
        <button
          type="button"
          onClick={() => void resend(turnstileToken)}
          disabled={loading}
          className="press-scale shrink-0 rounded-lg border border-[var(--primary)]/40 px-3 py-1.5 text-xs font-medium text-[var(--primary)] transition hover:bg-[var(--primary)]/10 disabled:opacity-60"
        >
          {loading ? "กำลังส่ง…" : "ส่งอีเมลอีกครั้ง"}
        </button>
      </div>
      {showCaptcha && (
        <div className="mx-auto mt-3 max-w-3xl">
          <TurnstileField
            onToken={(token) => {
              setTurnstileToken(token);
              void resend(token);
            }}
            onExpire={() => setTurnstileToken(null)}
          />
        </div>
      )}
      {message && (
        <p className="mx-auto mt-2 max-w-3xl text-xs text-[var(--muted-2)]">{message}</p>
      )}
    </div>
  );
}
