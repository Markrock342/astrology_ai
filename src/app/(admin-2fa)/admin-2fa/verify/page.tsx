"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Admin2faVerifyPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function verify() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", code }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "ยืนยันไม่สำเร็จ");
      router.replace("/admin");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ยืนยันไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12">
      <h1 className="text-xl font-semibold text-[var(--foreground)]">
        ยืนยัน Admin 2FA
      </h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        ใส่รหัส 6 หลักจากแอป Authenticator หรือรหัสสำรอง
      </p>
      {error ? (
        <p className="mt-4 text-sm text-[var(--danger)]">{error}</p>
      ) : null}
      <label className="mt-6 block text-xs text-[var(--muted)]">
        รหัส
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          inputMode="numeric"
          autoComplete="one-time-code"
          className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm"
        />
      </label>
      <button
        type="button"
        disabled={busy || code.trim().length < 6}
        onClick={() => void verify()}
        className="mt-4 w-full rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] disabled:opacity-50"
      >
        {busy ? "กำลังตรวจ…" : "ยืนยัน"}
      </button>
    </main>
  );
}
