"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

/**
 * Single sign-in surface (design 01): Google + email. There is no separate
 * register page — first email/Google sign-in auto-creates the account
 * (see Credentials authorize + ensureOAuthUser).
 *
 * NOTE (PM): email flow (magic-link vs email+password) is still unconfirmed.
 * We show the email field first (matching the mockup) and progressively reveal
 * a password field so either decision is a small change here.
 */
export function SignInForm({ googleEnabled = false }: { googleEnabled?: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"email" | "password">("email");
  const [loading, setLoading] = useState<"google" | "email" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleGoogle() {
    setError(null);
    if (!googleEnabled) {
      setError("Google login ยังไม่เปิดใช้งาน (รอตั้งค่า AUTH_GOOGLE_ID/SECRET)");
      return;
    }
    setLoading("google");
    await signIn("google", { callbackUrl: "/onboarding" });
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (step === "email") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setError("กรุณากรอกอีเมลให้ถูกต้อง");
        return;
      }
      setStep("password");
      return;
    }

    if (password.length < 8) {
      setError("รหัสผ่านอย่างน้อย 8 ตัวอักษร");
      return;
    }

    setLoading("email");
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(null);

    if (res?.error) {
      setError("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
      return;
    }
    // Full reload so the new session cookie is picked up by server components.
    window.location.href = "/onboarding";
  }

  return (
    <div className="animate-fade-up w-full max-w-md rounded-3xl border border-[var(--border)] bg-[var(--surface)]/80 p-8 shadow-2xl backdrop-blur">
      <button
        type="button"
        onClick={handleGoogle}
        disabled={loading !== null}
        className="press-scale flex w-full items-center justify-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--surface-3)] disabled:opacity-60"
      >
        <GoogleIcon />
        {loading === "google" ? "กำลังเชื่อมต่อ…" : "Continue with Google"}
      </button>

      <div className="my-5 flex items-center gap-3 text-xs text-[var(--muted-2)]">
        <span className="h-px flex-1 bg-[var(--border)]" />
        หรือ
        <span className="h-px flex-1 bg-[var(--border)]" />
      </div>

      <form onSubmit={handleEmail} className="flex flex-col gap-3">
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="อีเมล"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={step === "password"}
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-2)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--ring)] disabled:opacity-70"
        />

        {step === "password" && (
          <input
            type="password"
            autoComplete="current-password"
            placeholder="รหัสผ่าน"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-2)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--ring)]"
          />
        )}

        {error && <p className="text-xs text-[var(--danger)]">{error}</p>}

        <button
          type="submit"
          disabled={loading !== null}
          className="press-scale w-full rounded-xl bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-[var(--primary-foreground)] transition hover:bg-[var(--primary-hover)] disabled:opacity-60"
        >
          {loading === "email"
            ? "กำลังเข้าสู่ระบบ…"
            : step === "email"
              ? "ลงชื่อเข้าใช้ด้วยอีเมล"
              : "เข้าสู่ระบบ"}
        </button>

        {step === "password" && (
          <button
            type="button"
            onClick={() => {
              setStep("email");
              setPassword("");
              setError(null);
            }}
            className="text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            ← ใช้อีเมลอื่น
          </button>
        )}
      </form>

      <p className="mt-6 text-center text-[11px] leading-relaxed text-[var(--muted-2)]">
        การดำเนินการต่อ ถือว่าคุณยอมรับ{" "}
        <a href="/privacy" className="text-[var(--muted)] underline underline-offset-2">
          นโยบายความเป็นส่วนตัว
        </a>{" "}
        ของเราแล้ว
      </p>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  );
}
