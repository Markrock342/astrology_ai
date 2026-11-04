"use client";
import { forwardRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { displayDayToIso, isoDayDisplay } from "@/lib/admin-dates";
import { TextInput } from "./ui";

export const AdminDateInput = forwardRef<HTMLInputElement, {
  value: string; onChange: (isoDay: string) => void; label: string; disabled?: boolean; required?: boolean;
}>(function AdminDateInput({ value, onChange, label, disabled, required }, ref) {
  const [seen, setSeen] = useState(value);
  const [draft, setDraft] = useState(isoDayDisplay(value));
  if (value !== seen) { setSeen(value); setDraft(isoDayDisplay(value)); }
  function update(text: string) {
    const iso = displayDayToIso(text) ?? "";
    setDraft(text); setSeen(iso); onChange(iso);
  }
  return <div className="relative">
    <TextInput ref={ref} aria-label={label} placeholder="dd/mm/yyyy" inputMode="numeric" autoComplete="off" maxLength={10}
      value={draft} onChange={e => update(e.target.value)} disabled={disabled} required={required} className="pr-12" />
    <span className="absolute right-1 top-0 flex h-full w-10 items-center justify-center text-[var(--muted)]">
      <CalendarDays size={17} aria-hidden />
      <input type="date" aria-label={`เลือก${label}จากปฏิทิน`} value={value} disabled={disabled} onClick={e => e.currentTarget.showPicker?.()}
        onChange={e => update(isoDayDisplay(e.target.value))} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
    </span>
  </div>;
});
