"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { signIn } from "next-auth/react";
import { GoogleIcon } from "./auth-icons";
import { EmailInput, PasswordField } from "./auth-fields";
import { TurnstileField, turnstileRequired } from "./turnstile-field";

type AuthTab = "login" | "register";

function parseTab(value: string | null): AuthTab {
  return value === "register" ? "register" : "login";
}

export function AuthCard({
  googleEnabled = false,
  consentRegisterLabel = "ยอมรับนโยบายความเป็นส่วนตัว",
}: {
  googleEnabled?: boolean;
  consentRegisterLabel?: string;
}) {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<AuthTab>(() => parseTab(searchParams.get("tab")));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(
    turnstileRequired() ? null : "",
  );
  const [loading, setLoading] = useState<"google" | "login" | "register" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const switchTab = useCallback((next: AuthTab) => {
    setTab(next);
    setError(null);
    setTurnstileToken(turnstileRequired() ? null : "");
  }, []);

  async function handleGoogle() {
    setError(null);
    if (!googleEnabled) {
      setError("ยังไม่เปิดใช้งาน Google — รอตั้งค่า AUTH_GOOGLE_ID/SECRET");
      return;
    }
    setLoading("google");
    await signIn("google", { callbackUrl: "/continue" });
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("กรุณากรอกอีเมลให้ถูกต้อง");
      return;
    }
    if (password.length < 8) {
      setError("รหัสผ่านอย่างน้อย 8 ตัวอักษร");
      return;
    }

    setLoading("login");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = (await res.json()) as { ok: boolean; error?: { message: string } };
      if (!json.ok) {
        setError(json.error?.message ?? "เข้าสู่ระบบไม่สำเร็จ");
        return;
      }
      window.location.href = "/continue";
    } catch {
      setError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    } finally {
      setLoading(null);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("กรุณากรอกอีเมลให้ถูกต้อง");
      return;
    }
    if (password.length < 8) {
      setError("รหัสผ่านอย่างน้อย 8 ตัวอักษร");
      return;
    }
    if (password !== confirmPassword) {
      setError("รหัสผ่านไม่ตรงกัน");
      return;
    }
    if (!acceptTerms) {
      setError("กรุณายอมรับนโยบายความเป็นส่วนตัว");
      return;
    }
    if (turnstileRequired() && !turnstileToken) {
      setError("กรุณายืนยันว่าไม่ใช่บอท");
      return;
    }

    setLoading("register");
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          acceptTerms: true,
          turnstileToken: turnstileToken ?? undefined,
        }),
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

      setError("สมัครสำเร็จแล้ว กรุณาเข้าสู่ระบบอีกครั้ง");
      switchTab("login");
    } catch {
      setError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    } finally {
      setLoading(null);
    }
  }

  const busy = loading !== null;

  return (
    <div className="animate-fade-up w-full max-w-[420px] rounded-2xl border border-[var(--border)] bg-[var(--surface)]/90 p-6 shadow-2xl shadow-black/40 backdrop-blur sm:p-8">
      {/* Segmented tabs — login-first, single surface (Notion/Linear pattern) */}
      <div
        role="tablist"
        aria-label="เข้าสู่ระบบหรือสมัครสมาชิก"
        className="mb-6 flex rounded-xl bg-[var(--surface-2)] p-1"
      >
        {(
          [
            ["login", "เข้าสู่ระบบ"],
            ["register", "สร้างบัญชี"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => switchTab(id)}
            className={`press-scale flex-1 rounded-lg py-2.5 text-sm font-medium transition ${
              tab === id
                ? "bg-[var(--surface)] text-[var(--foreground)] shadow-sm"
                : "text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Social-first — same entry on both tabs */}
      <button
        type="button"
        onClick={() => void handleGoogle()}
        disabled={busy}
        className="press-scale flex w-full items-center justify-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--surface-3)] disabled:opacity-60"
      >
        <GoogleIcon />
        {loading === "google" ? "กำลังเชื่อมต่อ…" : "เข้าสู่ระบบด้วย Google"}
      </button>

      <div className="my-5 flex items-center gap-3 text-xs text-[var(--muted-2)]">
        <span className="h-px flex-1 bg-[var(--border)]" />
        หรือใช้อีเมล
        <span className="h-px flex-1 bg-[var(--border)]" />
      </div>

      {tab === "login" ? (
        <form onSubmit={handleLogin} className="flex flex-col gap-3" role="tabpanel">
          <EmailInput value={email} onChange={setEmail} />
          <PasswordField
            value={password}
            onChange={setPassword}
            placeholder="รหัสผ่าน"
            autoComplete="current-password"
            show={showPassword}
            onToggle={() => setShowPassword((v) => !v)}
          />
          <div className="flex justify-end">
            <Link
              href="/forgot-password"
              className="text-xs text-[var(--muted)] underline underline-offset-2 transition hover:text-[var(--foreground)]"
            >
              ลืมรหัสผ่าน?
            </Link>
          </div>

          {error && <p className="text-xs text-[var(--danger)]">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="press-scale mt-1 w-full rounded-xl bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-[var(--primary-foreground)] transition hover:bg-[var(--primary-hover)] disabled:opacity-60"
          >
            {loading === "login" ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
          </button>

          <p className="mt-2 text-center text-xs text-[var(--muted)]">
            ยังไม่มีบัญชี?{" "}
            <button
              type="button"
              onClick={() => switchTab("register")}
              className="font-medium text-[var(--primary)] underline underline-offset-2"
            >
              สร้างบัญชี
            </button>
          </p>
        </form>
      ) : (
        <form onSubmit={handleRegister} className="flex flex-col gap-3" role="tabpanel">
          <EmailInput value={email} onChange={setEmail} />
          <PasswordField
            value={password}
            onChange={setPassword}
            placeholder="รหัสผ่าน (อย่างน้อย 8 ตัว)"
            autoComplete="new-password"
            show={showPassword}
            onToggle={() => setShowPassword((v) => !v)}
          />
          <PasswordField
            value={confirmPassword}
            onChange={setConfirmPassword}
            placeholder="ยืนยันรหัสผ่าน"
            autoComplete="new-password"
            show={showPassword}
            onToggle={() => setShowPassword((v) => !v)}
          />

          <label className="flex cursor-pointer items-start gap-2 text-xs text-[var(--muted)]">
            <input
              type="checkbox"
              checked={acceptTerms}
              onChange={(e) => setAcceptTerms(e.target.checked)}
              className="mt-0.5 rounded border-[var(--border)]"
            />
            <span>
              {consentRegisterLabel}{" "}
              <Link href="/privacy" className="text-[var(--primary)] underline underline-offset-2">
                (อ่านฉบับเต็ม)
              </Link>
            </span>
          </label>

          <TurnstileField
            onToken={setTurnstileToken}
            onExpire={() => setTurnstileToken(null)}
          />

          {error && <p className="text-xs text-[var(--danger)]">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="press-scale mt-1 w-full rounded-xl bg-[var(--secondary-active)] px-4 py-3 text-sm font-semibold text-[var(--secondary-foreground)] transition hover:brightness-110 disabled:opacity-60"
          >
            {loading === "register" ? "กำลังสร้างบัญชี…" : "สร้างบัญชี"}
          </button>

          <p className="mt-2 text-center text-xs text-[var(--muted)]">
            มีบัญชีแล้ว?{" "}
            <button
              type="button"
              onClick={() => switchTab("login")}
              className="font-medium text-[var(--primary)] underline underline-offset-2"
            >
              เข้าสู่ระบบ
            </button>
          </p>
        </form>
      )}
    </div>
  );
}
