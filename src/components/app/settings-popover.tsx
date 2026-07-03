"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { useAppData } from "./app-data-provider";

// Total birthday settings allowed = 1 initial + 1 edit (design shows x/2).
const BIRTH_TOTAL = 2;

export type SettingsModal = "rename" | "password" | "cancel" | null;

export function SettingsPopover({
  onClose,
  onOpenModal,
}: {
  onClose: () => void;
  onOpenModal: (m: SettingsModal) => void;
}) {
  const router = useRouter();
  const { user } = useAppData();
  const ref = useRef<HTMLDivElement>(null);
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
      .catch(() => {});
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

  const birthExhausted = editsRemaining === 0;
  const birthCurrent = BIRTH_TOTAL - (editsRemaining ?? BIRTH_TOTAL - 1);
  const birthHint =
    editsRemaining === null
      ? "…"
      : birthExhausted
        ? "ครบแล้ว"
        : `(ครั้งที่ ${birthCurrent}/${BIRTH_TOTAL})`;

  const displayName = user?.name ?? "ผู้ใช้";

  return (
    <div
      ref={ref}
      className="animate-fade-up absolute bottom-full left-0 z-50 mb-2 w-full min-w-[260px] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-1.5 shadow-2xl"
    >
      <p className="px-3 pb-1.5 pt-1 text-[11px] font-medium uppercase tracking-wider text-[var(--muted-2)]">
        การตั้งค่า
      </p>
      <Row
        icon={<UserIcon />}
        label="เปลี่ยนชื่อผู้ใช้"
        hint={displayName}
        onClick={() => onOpenModal("rename")}
      />
      <Row
        icon={<KeyIcon />}
        label="เปลี่ยนรหัสผ่าน"
        hint="(Password)"
        onClick={() => onOpenModal("password")}
      />
      <Row
        icon={<CalendarIcon />}
        label="เปลี่ยนวันเกิด"
        hint={birthHint}
        disabled={birthExhausted}
        onClick={() => {
          onClose();
          router.push("/onboarding");
        }}
      />
      <Row
        icon={<PackageIcon />}
        label="จัดการแพ็กเกจ"
        highlight
        onClick={() => {
          onClose();
          router.push("/account");
        }}
      />
      <Row
        icon={<LogoutIcon />}
        label="ออกจากระบบ"
        onClick={() => void signOut({ callbackUrl: "/login" })}
      />
      <div className="mt-1 border-t border-[var(--border)] pt-1">
        <button
          type="button"
          onClick={() => onOpenModal("cancel")}
          className="w-full rounded-lg px-3 py-2 text-center text-xs text-[var(--muted-2)] transition hover:bg-[var(--surface-3)] hover:text-[var(--muted)]"
        >
          ยกเลิกการเป็นสมาชิก
        </button>
      </div>
    </div>
  );
}

function Row({
  icon,
  label,
  hint,
  onClick,
  highlight,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  onClick: () => void;
  highlight?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition ${
        highlight
          ? "bg-[var(--surface-3)] text-[var(--foreground)]"
          : "text-[var(--foreground)] hover:bg-[var(--surface-3)]"
      } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
    >
      <span className="shrink-0 text-[var(--muted)]">{icon}</span>
      <span className="flex-1">{label}</span>
      {hint && (
        <span className="max-w-[100px] truncate text-xs text-[var(--muted-2)]">
          {hint}
        </span>
      )}
    </button>
  );
}

const ICON = { width: 17, height: 17, viewBox: "0 0 24 24", fill: "none" } as const;
const LINE = {
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function UserIcon() {
  return (
    <svg {...ICON}>
      <circle cx="12" cy="8" r="3.4" {...LINE} />
      <path d="M5.5 20c.6-3.3 3.2-5 6.5-5s5.9 1.7 6.5 5" {...LINE} />
    </svg>
  );
}
function KeyIcon() {
  return (
    <svg {...ICON}>
      <circle cx="8" cy="15" r="3.5" {...LINE} />
      <path d="M10.5 12.5L20 3M17 6l2 2M14 9l2 2" {...LINE} />
    </svg>
  );
}
function CalendarIcon() {
  return (
    <svg {...ICON}>
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" {...LINE} />
      <path d="M3.5 9.5h17M8 3v3M16 3v3" {...LINE} />
    </svg>
  );
}
function PackageIcon() {
  return (
    <svg {...ICON}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" {...LINE} />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" {...LINE} />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" {...LINE} />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" {...LINE} />
    </svg>
  );
}
function LogoutIcon() {
  return (
    <svg {...ICON}>
      <path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3" {...LINE} />
      <path d="M15 8l4 4-4 4M19 12H9" {...LINE} />
    </svg>
  );
}
