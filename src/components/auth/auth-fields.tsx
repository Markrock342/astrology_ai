"use client";

import { EyeIcon, EyeOffIcon } from "./auth-icons";

const inputClass =
  // text-base on mobile (16px) so iOS Safari does not zoom the page on focus.
  "w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-base text-[var(--foreground)] placeholder:text-[var(--muted-2)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--ring)] md:text-sm";

export function PasswordField({
  value,
  onChange,
  placeholder,
  autoComplete,
  show,
  onToggle,
  autoFocus,
  label,
  invalid,
  describedBy,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  autoComplete: string;
  show: boolean;
  onToggle: () => void;
  autoFocus?: boolean;
  /** Accessible name; defaults to the placeholder (which vanishes on typing). */
  label?: string;
  invalid?: boolean;
  /** id of the error message this field should be read with. */
  describedBy?: string;
}) {
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-label={label ?? placeholder}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoFocus={autoFocus}
        className={`${inputClass} pr-11`}
      />
      <button
        type="button"
        onClick={onToggle}
        className="absolute right-1 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--muted-2)] transition hover:text-[var(--foreground)] focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        aria-label={show ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
        aria-pressed={show}
      >
        {show ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}

export function EmailInput({
  value,
  onChange,
  disabled,
  invalid,
  describedBy,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
}) {
  return (
    <input
      type="email"
      inputMode="email"
      autoComplete="email"
      placeholder="อีเมล"
      aria-label="อีเมล"
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={`${inputClass} disabled:opacity-70`}
    />
  );
}
