"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";

/** Self-serve PDPA account deletion — confirm by typing email. */
export function DeleteAccountCard({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDelete() {
    if (confirm.trim().toLowerCase() !== email.trim().toLowerCase()) {
      setError("พิมพ์อีเมลให้ตรงกับบัญชีของคุณ");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/me/account", { method: "DELETE" });
      const json = (await res.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "ลบบัญชีไม่สำเร็จ");
      }
      await signOut({ callbackUrl: "/" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "ลบบัญชีไม่สำเร็จ");
      setBusy(false);
    }
  }

  return (
    <div className="mt-10 rounded-2xl border border-[var(--danger)]/35 bg-[var(--surface)] p-6">
      <h2 className="text-sm font-semibold text-[var(--danger)]">ลบบัญชี</h2>
      <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
        ลบโปรไฟล์ วันเกิด บทสนทนา เครดิต และสลิปที่เกี่ยวข้องถาวร — ทำแล้วกู้คืนไม่ได้
      </p>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-4 rounded-xl border border-[var(--danger)]/50 px-4 py-2.5 text-sm font-semibold text-[var(--danger)] transition hover:bg-[var(--danger)]/10"
        >
          ต้องการลบบัญชี
        </button>
      ) : (
        <div className="mt-4 space-y-3">
          <label className="block text-xs text-[var(--muted)]">
            พิมพ์อีเมล <span className="font-medium text-[var(--foreground)]">{email}</span>{" "}
            เพื่อยืนยัน
            <input
              type="email"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="off"
              className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none focus:border-[var(--danger)]"
            />
          </label>
          {error ? <p className="text-xs text-[var(--danger)]">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void onDelete()}
              className="rounded-xl bg-[var(--danger)] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "กำลังลบ…" : "ลบบัญชีถาวร"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setOpen(false);
                setConfirm("");
                setError(null);
              }}
              className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm text-[var(--muted)]"
            >
              ยกเลิก
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
