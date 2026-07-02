"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { MOCK_USER } from "./nav-data";

/**
 * Settings popover (design 04). Opens above the user bar. Birthday change shows
 * a used/total counter and disables when the one allowed edit is spent.
 *
 * The birthday counter/lock reflects the REAL profile from
 * GET /api/me/birth-profile (not a mock) so it stays in sync with the server
 * guard on /onboarding — otherwise the row looks clickable but silently
 * redirects back.
 *
 * TODO(backend): wire the remaining actions (rename, change password, manage
 * package, cancel membership) to their API/route.
 */

// Total birthday settings allowed = 1 initial + 1 edit (design shows x/2).
const BIRTH_TOTAL = 2;

export function SettingsPopover({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  // null = still loading the real value.
  const [editsRemaining, setEditsRemaining] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/me/birth-profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (alive && json?.data) {
          setEditsRemaining(json.data.editsRemaining ?? 0);
        }
      })
      .catch(() => {
        /* keep loading state; row stays enabled as a safe default */
      });
    return () => {
      alive = false;
    };
  }, []);

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

  // editsRemaining: 1 = can still edit → showing setting #1 of 2; 0 = exhausted.
  const birthExhausted = editsRemaining === 0;
  const birthCurrent = BIRTH_TOTAL - (editsRemaining ?? BIRTH_TOTAL - 1);
  const birthHint =
    editsRemaining === null
      ? "…"
      : birthExhausted
        ? "ครบแล้ว"
        : `(ครั้งที่ ${birthCurrent}/${BIRTH_TOTAL})`;

  return (
    <div
      ref={ref}
      className="absolute bottom-full left-0 mb-2 w-full overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] shadow-2xl"
    >
      <Row label="เปลี่ยนชื่อผู้ใช้" hint={MOCK_USER.name} onClick={() => {}} />
      <Row label="เปลี่ยนรหัสผ่าน" hint="Password" onClick={() => {}} />
      <Row
        label="เปลี่ยนวันเกิด"
        hint={birthHint}
        disabled={birthExhausted}
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
