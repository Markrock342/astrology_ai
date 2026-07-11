"use client";

import Link from "next/link";
import { useState } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { TurnstileField, turnstileRequired } from "@/components/auth/turnstile-field";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(
    turnstileRequired() ? null : "",
  );
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("กรุณากรอกอีเมลให้ถูกต้อง");
      return;
    }
    if (turnstileRequired() && !turnstileToken) {
      setError("กรุณายืนยันว่าไม่ใช่บอท");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, turnstileToken: turnstileToken ?? undefined }),
      });
      const json = (await res.json()) as { ok: boolean; error?: { message: string } };
      if (!json.ok) {
        setError(json.error?.message ?? "ไม่สามารถส่งคำขอได้");
        return;
      }
      setSent(true);
    } catch {
      setError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <BrandLogo size={44} className="mb-10" />

      <div className="animate-fade-up w-full max-w-md rounded-3xl border border-[var(--border)] bg-[var(--surface)]/80 p-8 shadow-2xl backdrop-blur">
        <h1 className="mb-2 text-center text-lg font-semibold text-[var(--foreground)]">
          ลืมรหัสผ่าน
        </h1>
        <p className="mb-6 text-center text-sm text-[var(--muted)]">
          กรอกอีเมลที่ใช้สมัคร เราจะส่งลิงก์ตั้งรหัสผ่านใหม่ให้
        </p>

        {sent ? (
          <div className="flex flex-col gap-4">
            <p className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-sm text-[var(--muted)]">
              หากมีบัญชีที่ใช้อีเมลนี้และตั้งรหัสผ่านไว้ เราได้ส่งลิงก์รีเซ็ตไปแล้ว
              กรุณาตรวจสอบกล่องจดหมาย (และโฟลเดอร์สแปม)
            </p>
            <Link
              href="/login"
              className="text-center text-sm text-[var(--muted)] underline underline-offset-2 hover:text-[var(--foreground)]"
            >
              ← กลับไปหน้าเข้าสู่ระบบ
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="อีเมล"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-2)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--ring)]"
            />

            <TurnstileField
              onToken={setTurnstileToken}
              onExpire={() => setTurnstileToken(null)}
            />

            {error && <p className="text-xs text-[var(--danger)]">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="press-scale w-full rounded-xl bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-[var(--primary-foreground)] transition hover:bg-[var(--primary-hover)] disabled:opacity-60"
            >
              {loading ? "กำลังส่ง…" : "ส่งลิงก์รีเซ็ตรหัสผ่าน"}
            </button>

            <Link
              href="/login"
              className="text-center text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
            >
              ← กลับไปหน้าเข้าสู่ระบบ
            </Link>
          </form>
        )}
      </div>
    </main>
  );
}
