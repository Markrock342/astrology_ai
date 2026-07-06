"use client";

import Link from "next/link";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { GoogleIcon } from "./auth-icons";
import { EmailInput, PasswordField } from "./auth-fields";
import { TurnstileField, turnstileRequired } from "./turnstile-field";

export function RegisterPanel({ googleEnabled = false }: { googleEnabled?: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(
    turnstileRequired() ? null : "",
  );
  const [loading, setLoading] = useState<"google" | "register" | null>(null);
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

  async function handleSubmit(e: React.FormEvent) {
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
    } catch {
      setError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex h-full flex-col rounded-3xl border border-[var(--border)] bg-[var(--surface)]/80 p-6 shadow-xl backdrop-blur sm:p-8">
      <h2 className="text-center text-lg font-semibold text-[var(--foreground)]">
        สมัครสมาชิก
      </h2>
      <p className="mt-1 text-center text-xs text-[var(--muted-2)]">
        สมาชิกใหม่ — สมัครด้วย Google หรืออีเมล
      </p>

      <button
        type="button"
        onClick={() => void handleGoogle()}
        disabled={loading !== null}
        className="press-scale mt-6 flex w-full items-center justify-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--surface-3)] disabled:opacity-60"
      >
        <GoogleIcon />
        {loading === "google" ? "กำลังเชื่อมต่อ…" : "Continue with Google"}
      </button>

      <div className="my-5 flex items-center gap-3 text-xs text-[var(--muted-2)]">
        <span className="h-px flex-1 bg-[var(--border)]" />
        หรือ
        <span className="h-px flex-1 bg-[var(--border)]" />
      </div>

      <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-3">
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
            ยอมรับ{" "}
            <Link href="/privacy" className="text-[var(--primary)] underline underline-offset-2">
              นโยบายความเป็นส่วนตัว
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
          disabled={loading !== null}
          className="press-scale mt-auto w-full rounded-xl bg-[var(--secondary-active)] px-4 py-3 text-sm font-semibold text-[var(--secondary-foreground)] transition hover:brightness-110 disabled:opacity-60"
        >
          {loading === "register" ? "กำลังสร้างบัญชี…" : "สมัครสมาชิก"}
        </button>
      </form>
    </div>
  );
}
