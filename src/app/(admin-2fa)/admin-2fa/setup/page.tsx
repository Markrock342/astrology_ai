"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function Admin2faSetupPage() {
  const router = useRouter();
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const statusRes = await fetch("/api/admin/2fa");
        const statusJson = await statusRes.json();
        if (statusJson?.data?.enrolled) {
          router.replace("/admin-2fa/verify");
          return;
        }
        const res = await fetch("/api/admin/2fa", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "begin" }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error?.message ?? "เริ่มตั้งค่าไม่สำเร็จ");
        if (!alive) return;
        setQr(json.data.qrDataUrl);
        setSecret(json.data.secretBase32);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "โหลดไม่สำเร็จ");
      }
    })();
    return () => {
      alive = false;
    };
  }, [router]);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm", code }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "ยืนยันไม่สำเร็จ");
      setBackupCodes(json.data.backupCodes as string[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ยืนยันไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12">
      <h1 className="text-xl font-semibold text-[var(--foreground)]">
        ตั้งค่า Admin 2FA
      </h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        สแกน QR ด้วยแอป Authenticator (Google / Authy) แล้วใส่รหัส 6 หลัก
      </p>

      {error ? (
        <p className="mt-4 text-sm text-[var(--danger)]">{error}</p>
      ) : null}

      {backupCodes ? (
        <div className="mt-6 space-y-3">
          <p className="text-sm font-semibold text-[var(--foreground)]">
            บันทึกรหัสสำรองไว้ในที่ปลอดภัย (ใช้ได้ครั้งเดียวต่อรหัส)
          </p>
          <ul className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 font-mono text-sm">
            {backupCodes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <button
            type="button"
            className="w-full rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--primary-foreground)]"
            onClick={() => router.replace("/admin")}
          >
            เข้าแอดมิน
          </button>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qr}
              alt="QR สำหรับ 2FA"
              className="mx-auto rounded-xl border border-[var(--border)] bg-white p-2"
            />
          ) : (
            <p className="text-sm text-[var(--muted)]">กำลังสร้าง QR…</p>
          )}
          {secret ? (
            <p className="break-all text-center text-[11px] text-[var(--muted-2)]">
              หรือใส่รหัสด้วยมือ: {secret}
            </p>
          ) : null}
          <label className="block text-xs text-[var(--muted)]">
            รหัสจากแอป
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
            onClick={() => void confirm()}
            className="w-full rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] disabled:opacity-50"
          >
            {busy ? "กำลังยืนยัน…" : "ยืนยันและเปิด 2FA"}
          </button>
        </div>
      )}
    </main>
  );
}
