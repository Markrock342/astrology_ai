"use client";

import { useState } from "react";
import { createPortal } from "react-dom";

type ModalProps = {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
};

function Modal({ title, onClose, children }: ModalProps) {
  // Modals only render from client-side popover interactions, but guard SSR.
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(e) => {
        // Click on the dark backdrop (not the card) closes the modal.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="animate-fade-up w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-5 shadow-2xl"
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-[var(--muted)] hover:bg-[var(--surface-3)]"
            aria-label="ปิด"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function RenameModal({
  currentName,
  onClose,
  onSaved,
}: {
  currentName: string;
  onClose: () => void;
  onSaved: (name: string) => void;
}) {
  const [name, setName] = useState(currentName);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json?.error?.message ?? "บันทึกไม่สำเร็จ");
        return;
      }
      onSaved(json.data.name);
      onClose();
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="เปลี่ยนชื่อผู้ใช้" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
          placeholder="ชื่อที่แสดง"
          autoFocus
        />
        {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="rounded-xl bg-[var(--primary)] py-2.5 text-sm font-semibold text-[var(--primary-foreground)] disabled:opacity-50"
        >
          {saving ? "กำลังบันทึก…" : "บันทึก"}
        </button>
      </form>
    </Modal>
  );
}

export function ChangePasswordModal({
  onClose,
}: {
  onClose: () => void;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/me/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json?.error?.message ?? "เปลี่ยนรหัสผ่านไม่สำเร็จ");
        return;
      }
      setSuccess(true);
      setTimeout(onClose, 1200);
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="เปลี่ยนรหัสผ่าน" onClose={onClose}>
      {success ? (
        <p className="text-sm text-[var(--secondary-active)]">เปลี่ยนรหัสผ่านเรียบร้อยแล้ว</p>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
            placeholder="รหัสผ่านปัจจุบัน"
            autoComplete="current-password"
          />
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            minLength={8}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
            placeholder="รหัสผ่านใหม่ (อย่างน้อย 8 ตัว)"
            autoComplete="new-password"
          />
          {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
          <button
            type="submit"
            disabled={saving || currentPassword.length < 8 || newPassword.length < 8}
            className="rounded-xl bg-[var(--primary)] py-2.5 text-sm font-semibold text-[var(--primary-foreground)] disabled:opacity-50"
          >
            {saving ? "กำลังบันทึก…" : "เปลี่ยนรหัสผ่าน"}
          </button>
        </form>
      )}
    </Modal>
  );
}

export function CancelMembershipModal({
  isPro,
  onClose,
  onCancelled,
}: {
  isPro: boolean;
  onClose: () => void;
  onCancelled: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function confirm() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/me/subscription/cancel", { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json?.error?.message ?? "ยกเลิกไม่สำเร็จ");
        return;
      }
      onCancelled();
      onClose();
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="ยกเลิกการเป็นสมาชิก" onClose={onClose}>
      {isPro ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-[var(--muted)]">
            ยกเลิกแพ็กเกจ Pro แล้วจะกลับเป็น Free ทันที — หมวดที่ล็อกจะใช้ไม่ได้อีก
          </p>
          {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
          <button
            type="button"
            onClick={confirm}
            disabled={saving}
            className="rounded-xl border border-[var(--danger)] py-2.5 text-sm font-semibold text-[var(--danger)] disabled:opacity-50"
          >
            {saving ? "กำลังยกเลิก…" : "ยืนยันยกเลิก Pro"}
          </button>
        </div>
      ) : (
        <p className="text-sm text-[var(--muted)]">
          คุณใช้แพ็กเกจ Free อยู่ — ไม่มีสมาชิกที่ต้องยกเลิก
        </p>
      )}
    </Modal>
  );
}
