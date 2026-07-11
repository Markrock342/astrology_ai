"use client";

import { useEffect, useId, useState } from "react";

/** Small shared primitives for Admin CMS pages (dark HORASARD theme). */

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-[var(--foreground)]">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-[var(--muted)]">{description}</p>
        )}
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
      className={`press-scale rounded-lg px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${styles}`}
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

export function TextInput({
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputClass} ${className}`} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputClass} min-h-28 resize-y font-mono text-xs leading-relaxed`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={inputClass} />;
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
      ? "border-[var(--primary)]/40 text-[var(--primary)]"
      : tone === "green"
        ? "border-[var(--secondary-active)]/40 text-[var(--secondary-active)]"
        : tone === "red"
          ? "border-[var(--danger)]/40 text-[var(--danger)]"
          : "border-[var(--border)] text-[var(--muted-2)]";
  return (
    <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] ${styles}`}>
      {children}
    </span>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 ${className}`}>
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "gold" | "green" | "danger";
}) {
  const valueColor =
    tone === "gold"
      ? "text-[var(--primary)]"
      : tone === "green"
        ? "text-[var(--secondary-active)]"
        : tone === "danger"
          ? "text-[var(--danger)]"
          : "text-[var(--foreground)]";
  return (
    <Card className="!p-4">
      <p className="text-[11px] text-[var(--muted)]">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${valueColor}`}>{value}</p>
      {hint && <p className="mt-1 text-[10px] text-[var(--muted-2)]">{hint}</p>}
    </Card>
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
      <p className="text-sm font-medium text-[var(--foreground)]">{title}</p>
      {description && (
        <p className="mt-2 max-w-md text-xs leading-relaxed text-[var(--muted)]">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </Card>
  );
}

export function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 rounded-xl border border-[var(--primary)]/20 bg-[var(--primary)]/5 px-4 py-3 text-xs leading-relaxed text-[var(--muted)]">
      {children}
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

/** Uniform fetch helper for admin API routes. Throws on { ok: false }. */
export async function adminFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const json = await res.json();
  if (!res.ok || !json.ok) {
    throw new Error(json?.error?.message ?? `Request failed (${res.status})`);
  }
  return json.data as T;
}

export function Modal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
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
        role="dialog"
        aria-modal
        aria-labelledby="admin-modal-title"
        className="relative z-10 w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 id="admin-modal-title" className="text-sm font-semibold text-[var(--foreground)]">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-1.5 text-[var(--muted)] hover:bg-[var(--surface-2)]"
            aria-label="ปิด"
          >
            ✕
          </button>
        </div>
        {children}
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
  useEffect(() => setLocal(value), [value]);
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
