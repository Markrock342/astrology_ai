"use client";

import Link from "next/link";
import { useState } from "react";
import { signIn } from "next-auth/react";

type Step = "email" | "login" | "register" | "google-only";

type CheckEmailResponse = {
  ok: boolean;
  data?: { exists: boolean; hasPassword: boolean };
  error?: { message: string };
};

/**
 * Single sign-in surface (design 01): Google + email.
 *
 * Flow:
 *   1. Enter email → check with backend
 *   2a. New email        → register (password + confirm)
 *   2b. Existing + pwd   → login (password only)
 *   2c. Existing Google  → guide to Google button
 *
 * Registration is explicit (POST /api/auth/register); sign-in never auto-creates.
 */
export function SignInForm({ googleEnabled = false }: { googleEnabled?: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [step, setStep] = useState<Step>("email");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState<"google" | "email" | null>(null);
  const [loadingPhase, setLoadingPhase] = useState<"check" | "register" | "login" | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  async function handleGoogle() {
    setError(null);
    if (!googleEnabled) {
      setError("Google login ยังไม่เปิดใช้งาน (รอตั้งค่า AUTH_GOOGLE_ID/SECRET)");
      return;
    }
    setLoading("google");
    await signIn("google", { callbackUrl: "/continue" });
  }

  function resetToEmail() {
    setStep("email");
    setPassword("");
    setConfirmPassword("");
    setError(null);
  }

  async function handleEmailStep(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("กรุณากรอกอีเมลให้ถูกต้อง");
      return;
    }

    setLoading("email");
    setLoadingPhase("check");
    try {
      const res = await fetch("/api/auth/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = (await res.json()) as CheckEmailResponse;

      if (!json.ok || !json.data) {
        setError(json.error?.message ?? "ไม่สามารถตรวจสอบอีเมลได้");
        return;
      }

      const { exists, hasPassword } = json.data;
      if (!exists) {
        setStep("register");
      } else if (hasPassword) {
        setStep("login");
      } else {
        setStep("google-only");
      }
    } catch {
      setError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    } finally {
      setLoading(null);
      setLoadingPhase(null);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("รหัสผ่านอย่างน้อย 8 ตัวอักษร");
      return;
    }
    if (password !== confirmPassword) {
      setError("รหัสผ่านไม่ตรงกัน");
      return;
    }

    setLoading("email");
    setLoadingPhase("register");
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, acceptTerms: true }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        data?: { signedIn?: boolean };
        error?: { message: string };
      };

      if (!json.ok) {
        setError(json.error?.message ?? "สมัครสมาชิกไม่สำเร็จ");
        return;
      }

      if (json.data?.signedIn) {
        window.location.href = "/continue";
        return;
      }

      setStep("login");
      setError("สมัครสำเร็จแล้ว กรุณาเข้าสู่ระบบอีกครั้ง");
    } catch {
      setError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    } finally {
      setLoading(null);
      setLoadingPhase(null);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("รหัสผ่านอย่างน้อย 8 ตัวอักษร");
      return;
    }

    setLoading("email");
    setLoadingPhase("login");
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(null);
    setLoadingPhase(null);

    if (res?.error) {
      setError("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
      return;
    }
    window.location.href = "/continue";
  }

  const onSubmit =
    step === "email"
      ? handleEmailStep
      : step === "register"
        ? handleRegister
        : step === "login"
          ? handleLogin
          : undefined;

  const submitLabel =
    loading === "email"
      ? loadingPhase === "check"
        ? "กำลังตรวจสอบอีเมล…"
        : loadingPhase === "register"
          ? "กำลังสร้างบัญชี…"
          : loadingPhase === "login"
            ? "กำลังเข้าสู่ระบบ…"
            : "กำลังดำเนินการ…"
      : step === "email"
        ? "ลงชื่อเข้าใช้ด้วยอีเมล"
        : step === "register"
          ? "สมัครสมาชิก"
          : step === "login"
            ? "เข้าสู่ระบบ"
            : "";

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

      {step === "google-only" ? (
        <div className="flex flex-col gap-3">
          <p className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-sm text-[var(--muted)]">
            บัญชี <span className="font-medium text-[var(--foreground)]">{email}</span>{" "}
            สมัครด้วย Google — กรุณาใช้ปุ่ม &quot;Continue with Google&quot; ด้านบน
          </p>
          <button
            type="button"
            onClick={resetToEmail}
            className="text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            ← ใช้อีเมลอื่น
          </button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="อีเมล"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={step !== "email"}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-2)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--ring)] disabled:opacity-70"
          />

          {step === "register" && (
            <>
              <PasswordField
                value={password}
                onChange={setPassword}
                placeholder="รหัสผ่าน (อย่างน้อย 8 ตัว)"
                autoComplete="new-password"
                show={showPassword}
                onToggle={() => setShowPassword((v) => !v)}
                autoFocus
              />
              <PasswordField
                value={confirmPassword}
                onChange={setConfirmPassword}
                placeholder="ยืนยันรหัสผ่าน"
                autoComplete="new-password"
                show={showPassword}
                onToggle={() => setShowPassword((v) => !v)}
              />
            </>
          )}

          {step === "login" && (
            <>
              <PasswordField
                value={password}
                onChange={setPassword}
                placeholder="รหัสผ่าน"
                autoComplete="current-password"
                show={showPassword}
                onToggle={() => setShowPassword((v) => !v)}
                autoFocus
              />
              <Link
                href="/forgot-password"
                className="self-end text-xs text-[var(--muted)] underline underline-offset-2 hover:text-[var(--foreground)]"
              >
                ลืมรหัสผ่าน?
              </Link>
            </>
          )}

          {error && <p className="text-xs text-[var(--danger)]">{error}</p>}

          <button
            type="submit"
            disabled={loading !== null}
            className="press-scale w-full rounded-xl bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-[var(--primary-foreground)] transition hover:bg-[var(--primary-hover)] disabled:opacity-60"
          >
            {submitLabel}
          </button>

          {step !== "email" && (
            <button
              type="button"
              onClick={resetToEmail}
              className="text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
            >
              ← ใช้อีเมลอื่น
            </button>
          )}
        </form>
      )}

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

function PasswordField({
  value,
  onChange,
  placeholder,
  autoComplete,
  show,
  onToggle,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  autoComplete: string;
  show: boolean;
  onToggle: () => void;
  autoFocus?: boolean;
}) {
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoFocus={autoFocus}
        className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 pr-11 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-2)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--ring)]"
      />
      <button
        type="button"
        onClick={onToggle}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-2)] transition hover:text-[var(--foreground)]"
        aria-label={show ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
        tabIndex={-1}
      >
        {show ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9.9 5.2A9.5 9.5 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-2.4 3.3M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.5 9.5 0 0 0 4.4-1.1"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.9 9.9a3 3 0 0 0 4.2 4.2M3 3l18 18"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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
