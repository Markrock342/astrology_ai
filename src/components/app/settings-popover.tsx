"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";

// Total birthday settings allowed = 1 initial + 1 edit (design shows x/2).
const BIRTH_TOTAL = 2;

export type SettingsModal = "rename" | "password" | "cancel" | null;

export function SettingsPopover({
  onClose,
  onOpenModal,
  anchorRef,
}: {
  onClose: () => void;
  onOpenModal: (m: SettingsModal) => void;
  anchorRef?: React.RefObject<HTMLElement | null>;
}) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const [editsRemaining, setEditsRemaining] = useState<number | null>(null);
  const [pos, setPos] = useState<{ left: number; bottom: number } | null>(null);

  // Warm the routes this popover navigates to so the click feels instant
  // instead of waiting on a cold dynamic (auth + DB) render.
  useEffect(() => {
    router.prefetch("/account");
    router.prefetch("/onboarding");
  }, [router]);

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

  // Anchor the popover to the profile button (ChatGPT-style) and float it
  // up-and-right over the content area. Fixed positioning escapes overflow.
  useLayoutEffect(() => {
    function place() {
      const el = anchorRef?.current;
      if (!el) {
        setPos({ left: 12, bottom: 84 });
        return;
      }
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) {
        setPos({ left: 12, bottom: 84 });
        return;
      }
      const width = 340;
      let left = r.left - 6;
      const maxLeft = window.innerWidth - width - 12;
      if (left > maxLeft) left = maxLeft;
      if (left < 12) left = 12;
      const bottom = window.innerHeight - r.top + 12;
      setPos({ left, bottom });
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [anchorRef]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      const target = e.target as Node;
      if (anchorRef?.current?.contains(target)) return;
      if (ref.current && !ref.current.contains(target)) onClose();
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
  }, [onClose, anchorRef]);

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
      style={pos ? { left: pos.left, bottom: pos.bottom } : undefined}
      className={`animate-fade-up fixed z-[60] w-[340px] max-w-[calc(100vw-24px)] overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface-2)] p-3 shadow-2xl ${
        pos ? "" : "invisible"
      }`}
    >
      <div className="flex items-center gap-3 px-1 pb-2.5 pt-0.5">
        <span className="text-[12px] font-medium text-[var(--muted)]">
          การตั้งค่า
        </span>
        <span className="h-px flex-1 bg-[var(--border)]" />
      </div>
      <div className="flex flex-col gap-2">
        <Row
          icon={<UserIcon />}
          label="เปลี่ยนชื่อผู้ใช้"
          hint="(Username)"
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
      </div>
      <button
        type="button"
        onClick={() => onOpenModal("cancel")}
        className="mt-2.5 w-full rounded-lg px-3 py-1.5 text-center text-[11px] text-[var(--muted-2)] transition hover:text-[var(--muted)]"
      >
        ยกเลิกการเป็นสมาชิก
      </button>
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
      className={`press-scale flex w-full items-center gap-3 rounded-full py-2.5 pl-2.5 pr-5 text-left text-[13px] transition ${
        highlight
          ? "bg-[var(--surface-3)] text-[var(--foreground)] hover:bg-[var(--border)]"
          : "bg-[var(--background)] text-[var(--foreground)] hover:bg-[var(--surface-3)]"
      } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
          highlight
            ? "bg-[var(--background)] text-[var(--primary)]"
            : "bg-[var(--surface-2)] text-[var(--primary)]"
        }`}
      >
        {icon}
      </span>
      <span className="flex-1">
        {label}
        {hint && <span className="ml-1 text-[var(--muted-2)]">{hint}</span>}
      </span>
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
