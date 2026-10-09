"use client";

import { forwardRef, useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Inbox, Info, type LucideIcon } from "lucide-react";
import { adminFetchTimeoutMessage } from "@/lib/admin-fetch-timeout";
import { ADMIN_NAV } from "@/config/admin-nav";

/** The sidebar icon of the page at this path (longest matching menu entry). */
function useNavIcon(): LucideIcon | null {
  const pathname = usePathname() ?? "";
  let best: (typeof ADMIN_NAV)[number] | null = null;
  for (const item of ADMIN_NAV) {
    if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
      if (!best || item.href.length > best.href.length) best = item;
    }
  }
  return best?.icon ?? null;
}

/** A rounded tile holding an icon — page headers, stat cards, section titles. */
export function IconTile({
  icon: Icon,
  tone = "gold",
  size = "md",
}: {
  icon: LucideIcon;
  tone?: "gold" | "green" | "red" | "blue" | "violet" | "muted";
  size?: "sm" | "md" | "lg";
}) {
  const tones = {
    gold: "bg-[var(--primary)]/12 text-[var(--primary)] ring-[var(--primary)]/25",
    green: "bg-[var(--secondary-active)]/12 text-[var(--secondary-active)] ring-[var(--secondary-active)]/25",
    red: "bg-[var(--danger)]/12 text-[var(--danger)] ring-[var(--danger)]/25",
    blue: "bg-sky-400/10 text-sky-300 ring-sky-400/25",
    violet: "bg-violet-400/10 text-violet-300 ring-violet-400/25",
    muted: "bg-[var(--surface-2)] text-[var(--muted)] ring-[var(--border)]",
  } as const;
  const dims = size === "lg" ? "h-11 w-11 rounded-2xl" : size === "sm" ? "h-7 w-7 rounded-lg" : "h-9 w-9 rounded-xl";
  const iconSize = size === "lg" ? 20 : size === "sm" ? 14 : 17;
  return (
    <span className={`inline-flex shrink-0 items-center justify-center ring-1 ring-inset ${dims} ${tones[tone]}`} aria-hidden>
      <Icon size={iconSize} strokeWidth={1.9} />
    </span>
  );
}

/** A card's heading row: icon, title, an optional line under it, an action on the right. */
export function CardTitle({
  icon,
  title,
  description,
  action,
  tone = "gold",
}: {
  icon?: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  tone?: "gold" | "green" | "red" | "blue" | "violet" | "muted";
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        {icon ? <IconTile icon={icon} tone={tone} size="sm" /> : null}
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-[var(--foreground)]">{title}</h2>
          {description ? <p className="mt-0.5 text-xs leading-5 text-[var(--muted)]">{description}</p> : null}
        </div>
      </div>
      {action}
    </div>
  );
}

/** Small shared primitives for Admin CMS pages (dark HORASARD theme). */

export function PageHeader({
  title,
  description,
  hint,
  action,
  icon,
}: {
  title: string;
  description?: string;
  /** A second, quieter line — for a rule the admin needs before editing. */
  hint?: string;
  action?: React.ReactNode;
  /** Defaults to this page's sidebar icon. */
  icon?: LucideIcon;
}) {
  const navIcon = useNavIcon();
  const Icon = icon ?? navIcon;
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-[var(--border)]/70 pb-5">
      <div className="flex min-w-0 items-start gap-3.5">
        {Icon ? <IconTile icon={Icon} size="lg" /> : null}
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-[var(--foreground)]">{title}</h1>
          {description && (
            <p className="mt-1 text-sm text-[var(--muted)]">{description}</p>
          )}
          {hint && (
            <p className="mt-1 max-w-3xl text-xs leading-5 text-[var(--muted-2)]">
              {hint}
            </p>
          )}
        </div>
      </div>
      {action}
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = "primary",
  disabled,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "danger";
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  const styles =
    variant === "primary"
      ? "bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)]"
      : variant === "danger"
        ? "border border-[var(--danger)]/40 text-[var(--danger)] hover:bg-[var(--danger)]/10"
        : "border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)]";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`press-scale inline-flex min-h-11 items-center justify-center rounded-lg px-3 py-2 text-xs font-medium transition disabled:opacity-50 ${styles}`}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-[var(--muted)]">{label}</span>
      {children}
      {hint && <span className="text-[10px] text-[var(--muted-2)]">{hint}</span>}
    </label>
  );
}

const inputClass =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-2)] outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--ring)]";

export const TextInput = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function TextInput({ className = "", ...props }, ref) {
  return <input ref={ref} {...props} className={`${inputClass} ${className}`} />;
});

export const TextArea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function TextArea(props, ref) {
  return (
    <textarea
      ref={ref}
      {...props}
      className={`${inputClass} min-h-28 resize-y font-mono text-xs leading-relaxed`}
    />
  );
});

export function Select({
  className = "",
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  // className used to be dropped here, so every "max-w-…" a page asked for
  // was ignored and the filter stretched across the whole row.
  return <select {...props} className={`${inputClass} ${className}`} />;
}

export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
          checked ? "bg-[var(--secondary-active)]" : "bg-[var(--surface-3)]"
        }`}
      >
        <span
          aria-hidden
          className={`pointer-events-none absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
      {label && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(!checked)}
          className="min-w-0 flex-1 pt-0.5 text-left text-xs leading-relaxed text-[var(--muted)] disabled:opacity-50"
        >
          {label}
        </button>
      )}
    </div>
  );
}

export function Badge({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: "gold" | "green" | "muted" | "red";
}) {
  const styles =
    tone === "gold"
      ? "border-[var(--primary)]/35 bg-[var(--primary)]/8 text-[var(--primary)]"
      : tone === "green"
        ? "border-[var(--secondary-active)]/35 bg-[var(--secondary-active)]/8 text-[var(--secondary-active)]"
        : tone === "red"
          ? "border-[var(--danger)]/35 bg-[var(--danger)]/8 text-[var(--danger)]"
          : "border-[var(--border)] bg-[var(--surface-2)]/60 text-[var(--muted-2)]";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${styles}`}>
      {children}
    </span>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-[var(--border)] bg-gradient-to-b from-[var(--surface)] to-[var(--surface)]/70 p-5 shadow-[0_1px_0_0_rgba(255,255,255,0.03)_inset] ${className}`}
    >
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
  icon,
  href,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "gold" | "green" | "danger" | "blue" | "violet";
  icon?: LucideIcon;
  /** Makes the whole card a link to the page behind the number. */
  href?: string;
}) {
  const valueColor =
    tone === "gold"
      ? "text-[var(--primary)]"
      : tone === "green"
        ? "text-[var(--secondary-active)]"
        : tone === "danger"
          ? "text-[var(--danger)]"
          : "text-[var(--foreground)]";
  const tileTone =
    tone === "danger" ? "red" : tone === "default" ? "muted" : tone;
  const body = (
    <Card className={`!p-4 h-full ${href ? "transition hover:border-[var(--primary)]/40 hover:bg-[var(--surface-2)]/40" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-medium text-[var(--muted)]">{label}</p>
        {icon ? <IconTile icon={icon} tone={tileTone} size="sm" /> : null}
      </div>
      <p className={`mt-2 text-2xl font-semibold tracking-tight tabular-nums ${valueColor}`}>{value}</p>
      {hint && <p className="mt-1 text-[11px] text-[var(--muted-2)]">{hint}</p>}
    </Card>
  );
  return href ? (
    <a href={href} className="block h-full rounded-2xl focus-visible:outline-2 focus-visible:outline-[var(--primary)]">
      {body}
    </a>
  ) : (
    body
  );
}

export function TableShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
      <table className="w-full min-w-[640px] text-left text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={`border-b border-[var(--border)] bg-[var(--surface-2)] px-4 py-2.5 text-[11px] font-medium uppercase tracking-wide text-[var(--muted)] ${className}`}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className = "",
  colSpan,
}: {
  children: React.ReactNode;
  className?: string;
  colSpan?: number;
}) {
  return (
    <td
      colSpan={colSpan}
      className={`border-b border-[var(--border)]/60 px-4 py-3 text-[var(--foreground)] ${className}`}
    >
      {children}
    </td>
  );
}

export function EmptyPanel({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col items-center justify-center py-12 text-center">
      <IconTile icon={Inbox} tone="muted" size="lg" />
      <p className="mt-3 text-sm font-medium text-[var(--foreground)]">{title}</p>
      {description && (
        <p className="mt-2 max-w-md text-xs leading-relaxed text-[var(--muted)]">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </Card>
  );
}

export function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-[var(--primary)]/20 bg-[var(--primary)]/5 px-4 py-3 text-xs leading-relaxed text-[var(--muted)]">
      <Info size={15} className="mt-0.5 shrink-0 text-[var(--primary)]" aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function NavGroupLabel({
  children,
  hint,
}: {
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="px-3 pb-1 pt-3 first:pt-0">
      <p className="text-[11px] font-medium text-[var(--foreground)]">{children}</p>
      {hint && <p className="text-[10px] text-[var(--muted-2)]">{hint}</p>}
    </div>
  );
}

export function AdminPage({ children }: { children: React.ReactNode }) {
  return <section className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">{children}</section>;
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <TableShell>
      <thead>
        <tr>
          <Th>
            <div className="h-3 w-20 animate-pulse rounded bg-[var(--surface-3)]" />
          </Th>
          <Th>
            <div className="h-3 w-16 animate-pulse rounded bg-[var(--surface-3)]" />
          </Th>
          <Th>
            <div className="h-3 w-12 animate-pulse rounded bg-[var(--surface-3)]" />
          </Th>
          <Th>
            <div className="h-3 w-14 animate-pulse rounded bg-[var(--surface-3)]" />
          </Th>
          <Th>
            <div className="h-3 w-16 animate-pulse rounded bg-[var(--surface-3)]" />
          </Th>
          <Th className="text-right">
            <div className="ml-auto h-3 w-12 animate-pulse rounded bg-[var(--surface-3)]" />
          </Th>
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }).map((_, i) => (
          <tr key={i}>
            <Td>
              <div className="h-4 w-32 animate-pulse rounded bg-[var(--surface-2)]" />
            </Td>
            <Td>
              <div className="h-4 w-16 animate-pulse rounded bg-[var(--surface-2)]" />
            </Td>
            <Td>
              <div className="h-4 w-12 animate-pulse rounded bg-[var(--surface-2)]" />
            </Td>
            <Td>
              <div className="h-4 w-14 animate-pulse rounded bg-[var(--surface-2)]" />
            </Td>
            <Td>
              <div className="h-4 w-16 animate-pulse rounded bg-[var(--surface-2)]" />
            </Td>
            <Td className="text-right">
              <div className="ml-auto h-4 w-12 animate-pulse rounded bg-[var(--surface-2)]" />
            </Td>
          </tr>
        ))}
      </tbody>
    </TableShell>
  );
}

export function CardSkeleton() {
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2">
        <div className="h-5 w-32 animate-pulse rounded bg-[var(--surface-2)]" />
        <div className="h-4 w-12 animate-pulse rounded bg-[var(--surface-2)]" />
        <div className="h-4 w-16 animate-pulse rounded bg-[var(--surface-2)]" />
      </div>
      <div className="mt-2 h-3 w-48 animate-pulse rounded bg-[var(--surface-2)]" />
    </Card>
  );
}

/** Default client timeout for long admin ops (health / AI test). */
export const ADMIN_FETCH_DEFAULT_TIMEOUT_MS = 90_000;

/**
 * Uniform fetch helper for admin API routes. Throws on { ok: false }.
 * Pass `timeoutMs` (or AbortSignal) to avoid hung buttons.
 */
export async function adminFetch<T>(
  url: string,
  init?: RequestInit & { timeoutMs?: number },
): Promise<T> {
  const { timeoutMs, signal: userSignal, ...rest } = init ?? {};
  const ms = timeoutMs ?? 0;
  const controller = ms > 0 ? new AbortController() : null;
  const timer =
    controller && ms > 0
      ? setTimeout(() => controller.abort(), ms)
      : null;

  try {
    const res = await fetch(url, {
      ...rest,
      signal: controller?.signal ?? userSignal,
      headers: { "Content-Type": "application/json", ...rest.headers },
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      throw new Error(json?.error?.message ?? `Request failed (${res.status})`);
    }
    return json.data as T;
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new Error(adminFetchTimeoutMessage(ms));
    }
    throw e;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function Modal({
  open,
  title,
  children,
  onClose,
  size = "md",
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  /** "lg" for dialogs that show a document — a reading trace, a raw prompt. */
  size?: "md" | "lg";
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previousFocus.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    const focusableSelector =
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const nodes = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector),
      ).filter((el) => !el.hasAttribute("disabled"));
      if (nodes.length === 0) {
        e.preventDefault();
        return;
      }
      const first = nodes[0]!;
      const last = nodes[nodes.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      previousFocus.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="ปิด"
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal
        aria-labelledby="admin-modal-title"
        // Capped to the screen and scrollable inside: long content used to run
        // off the bottom with the page locked behind it, so it could not be
        // read at all.
        className={`relative z-10 flex max-h-[calc(100dvh-2rem)] w-full flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl ${
          size === "lg" ? "max-w-3xl" : "max-w-md"
        }`}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 px-5 pb-3 pt-5">
          <h2 id="admin-modal-title" className="text-sm font-semibold text-[var(--foreground)]">
            {title}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="rounded-md px-1.5 text-[var(--muted)] hover:bg-[var(--surface-2)]"
            aria-label="ปิด"
          >
            ✕
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5">
          {children}
        </div>
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "ยืนยัน",
  cancelLabel = "ยกเลิก",
  danger,
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal open={open} title={title} onClose={onCancel}>
      {description && (
        <p className="mb-4 text-xs leading-relaxed text-[var(--muted)]">{description}</p>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          {cancelLabel}
        </Button>
        <Button
          variant={danger ? "danger" : "primary"}
          onClick={onConfirm}
          disabled={busy}
        >
          {busy ? "กำลังดำเนินการ…" : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

type ToastTone = "ok" | "error" | "info";

export function useToast() {
  const [toast, setToast] = useState<{
    message: string;
    tone: ToastTone;
  } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

  return {
    toast,
    showToast: (message: string, tone: ToastTone = "ok") => setToast({ message, tone }),
    clearToast: () => setToast(null),
  };
}

export function ToastHost({
  toast,
}: {
  toast: { message: string; tone: ToastTone } | null;
}) {
  if (!toast) return null;
  const toneClass =
    toast.tone === "error"
      ? "border-[var(--danger)]/40 bg-[var(--danger)]/10 text-[var(--danger)]"
      : toast.tone === "info"
        ? "border-[var(--border)] bg-[var(--surface-2)] text-[var(--foreground)]"
        : "border-[var(--secondary-active)]/40 bg-[var(--secondary-active)]/10 text-[var(--secondary-active)]";
  return (
    <div
      role="status"
      className={`fixed bottom-4 right-4 z-50 max-w-sm rounded-xl border px-4 py-3 text-xs shadow-lg ${toneClass}`}
    >
      {toast.message}
    </div>
  );
}

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: Array<{ id: string; label: string }>;
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="mb-4 flex flex-wrap gap-1 border-b border-[var(--border)] pb-2">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`rounded-lg px-3 py-1.5 text-xs transition ${
            active === tab.id
              ? "bg-[var(--surface-3)] font-medium text-[var(--primary)]"
              : "text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = "ค้นหา…",
  debounceMs = 300,
  className = "max-w-xs",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  debounceMs?: number;
  className?: string;
}) {
  const [local, setLocal] = useState(value);
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setLocal(value);
  }
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (local !== value) onChange(local);
    }, debounceMs);
    return () => window.clearTimeout(t);
  }, [local, debounceMs, onChange, value]);

  return (
    <TextInput
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      placeholder={placeholder}
      className={className}
    />
  );
}

export function CharCounter({
  value,
  max,
  warnAt,
}: {
  value: string;
  max: number;
  warnAt?: number;
}) {
  const len = value.length;
  const warn = warnAt ?? Math.floor(max * 0.85);
  const over = len > max;
  return (
    <span
      className={`text-[10px] tabular-nums ${
        over ? "text-[var(--danger)]" : len >= warn ? "text-[var(--primary)]" : "text-[var(--muted-2)]"
      }`}
    >
      {len}/{max}
    </span>
  );
}

export function ImageUploadField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  hint?: string;
}) {
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File | null) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/admin/upload", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error?.message ?? "อัปโหลดไม่สำเร็จ");
      }
      onChange(String(json.data.url));
    } catch (e) {
      setError(e instanceof Error ? e.message : "อัปโหลดไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Field label={label} hint={hint}>
      <div className="flex flex-col gap-2">
        <TextInput
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://… หรืออัปโหลดด้านล่าง"
        />
        <div className="flex flex-wrap items-center gap-2">
          <label
            htmlFor={id}
            className="cursor-pointer rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--muted)] hover:bg-[var(--surface-2)]"
          >
            {busy ? "กำลังอัปโหลด…" : "เลือกไฟล์รูป"}
          </label>
          <input
            id={id}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={busy}
            onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
          />
          {value && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value}
              alt=""
              className="h-12 max-w-[120px] rounded border border-[var(--border)] object-cover"
            />
          )}
        </div>
        {error && <p className="text-[11px] text-[var(--danger)]">{error}</p>}
      </div>
    </Field>
  );
}
