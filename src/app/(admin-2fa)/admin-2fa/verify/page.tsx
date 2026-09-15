"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Mode = "totp" | "backup";

const TOTP_LENGTH = 6;
/** Backup codes are 8 hex characters (see admin-2fa-service). */
const BACKUP_LENGTH = 8;

export default function Admin2faVerifyPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("totp");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const inFlightRef = useRef(false);

  const required = mode === "totp" ? TOTP_LENGTH : BACKUP_LENGTH;

  async function verify(value: string) {
    if (inFlightRef.current || value.length < required) return;
    inFlightRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", code: value }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "ยืนยันไม่สำเร็จ");
      router.replace("/admin");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ยืนยันไม่สำเร็จ");
      // A wrong OTP is retyped from scratch — keep the field ready for it.
      setCode("");
      inputRef.current?.focus();
    } finally {
      inFlightRef.current = false;
      setBusy(false);
    }
  }

  function onChange(raw: string) {
    const clean =
      mode === "totp"
        ? raw.replace(/\D/g, "").slice(0, TOTP_LENGTH)
        : raw.toLowerCase().replace(/[^0-9a-f]/g, "").slice(0, BACKUP_LENGTH);
    setCode(clean);
    // Six digits is the whole OTP — submit without a second tap.
    if (mode === "totp" && clean.length === TOTP_LENGTH) void verify(clean);
  }

  function switchMode(next: Mode) {
    setMode(next);
    setCode("");
    setError(null);
    inputRef.current?.focus();
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12">
      <h1 className="text-xl font-semibold text-[var(--foreground)]">
        ยืนยัน Admin 2FA
      </h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        {mode === "totp"
          ? "ใส่รหัส 6 หลักจากแอป Authenticator — ครบ 6 หลักจะยืนยันให้ทันที"
          : "ใส่รหัสสำรอง 8 ตัว (ตัวเลขและ a–f)"}
      </p>
      {error ? (
        <p className="mt-4 text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}
      <label className="mt-6 block text-xs text-[var(--muted)]">
        {mode === "totp" ? "รหัส 6 หลัก" : "รหัสสำรอง"}
        <input
          ref={inputRef}
          value={code}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void verify(code);
          }}
          inputMode={mode === "totp" ? "numeric" : "text"}
          pattern={mode === "totp" ? "[0-9]*" : "[0-9a-fA-F]*"}
          maxLength={required}
          autoComplete="one-time-code"
          autoFocus
          disabled={busy}
          aria-invalid={error ? true : undefined}
          className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-center text-2xl tracking-[0.4em] text-[var(--foreground)] outline-none focus:border-[var(--primary)] disabled:opacity-60"
        />
      </label>
      <button
        type="button"
        disabled={busy || code.length < required}
        onClick={() => void verify(code)}
        className="mt-4 w-full rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] disabled:opacity-50"
      >
        {busy ? "กำลังตรวจ…" : "ยืนยัน"}
      </button>
      <button
        type="button"
        onClick={() => switchMode(mode === "totp" ? "backup" : "totp")}
        className="mt-3 text-xs text-[var(--muted)] underline underline-offset-2 hover:text-[var(--foreground)]"
      >
        {mode === "totp" ? "ใช้รหัสสำรองแทน" : "กลับไปใช้รหัสจากแอป"}
      </button>
    </main>
  );
}
