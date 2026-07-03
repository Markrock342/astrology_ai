"use client";

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

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={inputClass} />;
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
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2 text-xs text-[var(--muted)]"
      aria-pressed={checked}
    >
      <span
        className={`relative h-5 w-9 rounded-full transition ${
          checked ? "bg-[var(--secondary-active)]" : "bg-[var(--surface-3)]"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
            checked ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </span>
      {label}
    </button>
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

export function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      {children}
    </div>
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
