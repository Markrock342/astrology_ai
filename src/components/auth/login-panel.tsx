"use client";

import Link from "next/link";
import { useState } from "react";
import { EmailInput, PasswordField } from "./auth-fields";
import { TurnstileField, turnstileRequired } from "./turnstile-field";

export function LoginPanel() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(
    turnstileRequired() ? null : "",
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    if (turnstileRequired() && !turnstileToken) {
      setError("กรุณายืนยันว่าไม่ใช่บอท");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, turnstileToken: turnstileToken ?? undefined }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        error?: { message: string };
      };

      if (!json.ok) {
        setError(json.error?.message ?? "เข้าสู่ระบบไม่สำเร็จ");
        return;
      }

      window.location.href = "/continue";
    } catch {
      setError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full flex-col rounded-3xl border border-[var(--border)] bg-[var(--surface)]/80 p-6 shadow-xl backdrop-blur sm:p-8">
      <h2 className="text-center text-lg font-semibold text-[var(--foreground)]">
        เข้าสู่ระบบ
      </h2>
      <p className="mt-1 text-center text-xs text-[var(--muted-2)]">
        มีบัญชีแล้ว? กรอกอีเมลและรหัสผ่าน
      </p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-1 flex-col gap-3">
        <EmailInput value={email} onChange={setEmail} />
        <PasswordField
          value={password}
          onChange={setPassword}
          placeholder="รหัสผ่าน"
          autoComplete="current-password"
          show={showPassword}
          onToggle={() => setShowPassword((v) => !v)}
        />
        <Link
          href="/forgot-password"
          className="self-end text-xs text-[var(--muted)] underline underline-offset-2 hover:text-[var(--foreground)]"
        >
          ลืมรหัสผ่าน?
        </Link>

        <TurnstileField
          onToken={setTurnstileToken}
          onExpire={() => setTurnstileToken(null)}
        />

        {error && <p className="text-xs text-[var(--danger)]">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="press-scale mt-auto w-full rounded-xl bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-[var(--primary-foreground)] transition hover:bg-[var(--primary-hover)] disabled:opacity-60"
        >
          {loading ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
        </button>
      </form>
    </div>
  );
}
