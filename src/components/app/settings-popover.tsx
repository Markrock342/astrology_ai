"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { MOCK_USER } from "./nav-data";

/**
 * Settings popover (design 04). Opens above the user bar. Birthday change shows
 * a used/total counter and disables when the one allowed edit is spent.
 *
 * TODO(backend): wire each action (rename, change password, edit birthday,
 * manage package, sign out, cancel membership) to its API/route.
 */
export function SettingsPopover({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const editUsed = MOCK_USER.birthEditCount; // 0 or 1
  const editExhausted = editUsed >= 1;

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute bottom-full left-0 mb-2 w-full overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] shadow-2xl"
    >
      <Row label="เปลี่ยนชื่อผู้ใช้" hint={MOCK_USER.name} onClick={() => {}} />
      <Row label="เปลี่ยนรหัสผ่าน" hint="Password" onClick={() => {}} />
      <Row
        label="เปลี่ยนวันเกิด"
        hint={`(ครั้งที่ ${editUsed + 1}/2)`}
        disabled={editExhausted}
        onClick={() => {
          onClose();
          router.push("/onboarding");
        }}
      />
      <Row label="จัดการแพ็กเกจ" highlight onClick={() => router.push("/account")} />
      <Row
        label="ออกจากระบบ"
        onClick={() => void signOut({ callbackUrl: "/login" })}
      />
      <Row label="ยกเลิกการเป็นสมาชิก" muted onClick={() => {}} />
    </div>
  );
}

function Row({
  label,
  hint,
  onClick,
  highlight,
  muted,
  disabled,
}: {
  label: string;
  hint?: string;
  onClick: () => void;
  highlight?: boolean;
  muted?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm transition ${
        highlight
          ? "bg-[var(--surface-3)] text-[var(--foreground)]"
          : muted
            ? "text-[var(--muted-2)] hover:bg-[var(--surface-3)]"
            : "text-[var(--foreground)] hover:bg-[var(--surface-3)]"
      } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
    >
      <span>{label}</span>
      {hint && <span className="text-xs text-[var(--muted-2)]">{hint}</span>}
    </button>
  );
}
