"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { WheelColumn, WheelGroup, type WheelOption } from "@/components/birth/wheel-picker";
import { BUDDHIST_YEAR_OFFSET } from "@/lib/date";
import {
  formatTransitDateKey,
  parseTransitDateKey,
  parseTypedTransitDate,
  TRANSIT_DATE_PRESETS,
  transitDateKeyFromPreset,
  transitDateLabelFromKey,

} from "@/lib/transit-date-pick";
import { bangkokDateKey } from "@/lib/reading-intent";

const THAI_MONTHS_ABBR = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
];

type Era = "BE" | "CE";

function partsFromKey(value: string) {
  return parseTransitDateKey(value) ?? parseTransitDateKey(bangkokDateKey())!;
}

function yearForEra(ceYear: number, era: Era) {
  return era === "BE" ? ceYear + BUDDHIST_YEAR_OFFSET : ceYear;
}

/**
 * The one date UI for วันจร — used by the composer picker and by the
 * future-date modal, so users meet the same wheels, presets and typed entry
 * everywhere. Fully controlled: reports every change through onChange with a
 * YYYY-MM-DD key; the host decides when to commit.
 */
export function TransitDateWheel({
  value,
  onChange,
  onPreset,
  onSubmit,
  hint = "พิมพ์วันที่ หรือหมุนวงล้อ",
}: {
  value: string;
  onChange: (key: string) => void;
  /** A preset chip was tapped (hosts may commit + close immediately). */
  onPreset?: (key: string) => void;
  /** Enter in the typed field. */
  onSubmit?: (key: string) => void;
  hint?: string;
}) {
  const initial = value ? partsFromKey(value) : partsFromKey(bangkokDateKey());
  const [era, setEra] = useState<Era>("BE");
  const [typed, setTyped] = useState(
    value ? (transitDateLabelFromKey(value) ?? value) : "",
  );
  const [day, setDay] = useState(String(initial.day));
  const [month, setMonth] = useState(String(initial.month));
  const [year, setYear] = useState(String(yearForEra(initial.year, "BE")));

  const ceYear = era === "BE" ? Number(year) - BUDDHIST_YEAR_OFFSET : Number(year);
  const daysInMonth = useMemo(() => {
    const m = Number(month);
    if (!Number.isFinite(ceYear) || !Number.isFinite(m) || m < 1) return 31;
    return new Date(Date.UTC(ceYear, m, 0)).getUTCDate();
  }, [ceYear, month]);
  const safeDay = Number(day) > daysInMonth ? String(daysInMonth) : day;

  const dayOptions = useMemo<WheelOption[]>(
    () =>
      Array.from({ length: daysInMonth }, (_, i) => ({
        value: String(i + 1),
        label: String(i + 1),
      })),
    [daysInMonth],
  );
  const monthOptions = useMemo<WheelOption[]>(
    () =>
      THAI_MONTHS_ABBR.map((label, i) => ({
        value: String(i + 1),
        label,
      })),
    [],
  );
  const yearOptions = useMemo<WheelOption[]>(() => {
    const nowCe = Number(bangkokDateKey().slice(0, 4));
    const offset = era === "BE" ? BUDDHIST_YEAR_OFFSET : 0;
    return Array.from({ length: 13 }, (_, i) => {
      const shown = nowCe - 2 + i + offset;
      return { value: String(shown), label: String(shown) };
    });
  }, [era]);

  function keyFromWheels(
    nextDay = safeDay,
    nextMonth = month,
    nextYear = year,
    nextEra = era,
  ): string | null {
    const ce =
      nextEra === "BE" ? Number(nextYear) - BUDDHIST_YEAR_OFFSET : Number(nextYear);
    const m = Number(nextMonth);
    const d = Number(nextDay);
    if (!Number.isFinite(ce) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
    return formatTransitDateKey(ce, m, d);
  }

  function pushWheels(nextDay: string, nextMonth: string, nextYear: string, nextEra = era) {
    const key = keyFromWheels(nextDay, nextMonth, nextYear, nextEra);
    if (!key) return;
    setTyped(transitDateLabelFromKey(key) ?? key);
    onChange(key);
  }

  function selectEra(next: Era) {
    if (next === era) return;
    const shown =
      next === "BE"
        ? Number(year) + BUDDHIST_YEAR_OFFSET
        : Number(year) - BUDDHIST_YEAR_OFFSET;
    setEra(next);
    setYear(String(shown));
  }

  function applyKey(key: string) {
    const parts = parseTransitDateKey(key);
    if (!parts) return;
    setDay(String(parts.day));
    setMonth(String(parts.month));
    setYear(String(yearForEra(parts.year, era)));
    setTyped(transitDateLabelFromKey(key) ?? key);
    onChange(key);
  }

  function currentKey(): string | null {
    return parseTypedTransitDate(typed) ?? keyFromWheels();
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[12px] font-medium text-[var(--foreground)]">วันจร</p>
        <span className="flex gap-1">
          <EraChip era={era} value="BE" label="พ.ศ." onSelect={selectEra} />
          <EraChip era={era} value="CE" label="ค.ศ." onSelect={selectEra} />
        </span>
      </div>
      <p className="mb-2 text-[11px] leading-4 text-[var(--muted)]">{hint}</p>
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        value={typed}
        onChange={(e) => {
          setTyped(e.target.value);
          const key = parseTypedTransitDate(e.target.value);
          if (key) {
            const parts = parseTransitDateKey(key);
            if (parts) {
              setDay(String(parts.day));
              setMonth(String(parts.month));
              setYear(String(yearForEra(parts.year, era)));
            }
            onChange(key);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            const key = currentKey();
            if (key) {
              onChange(key);
              onSubmit?.(key);
            }
          }
        }}
        placeholder="เช่น 15/10/2569 หรือ 15 ต.ค. 2569"
        aria-label="พิมพ์วันจร"
        className="mb-2 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[13px] tabular-nums text-[var(--foreground)] outline-none placeholder:text-[var(--muted-2)] focus:border-[var(--primary)]/70 focus:ring-1 focus:ring-[var(--primary)]/30"
      />
      <div className="mb-2 flex flex-wrap gap-1">
        {TRANSIT_DATE_PRESETS.map((p) => (
          <button
            key={p.kind}
            type="button"
            onClick={() => {
              const key = transitDateKeyFromPreset(p.kind);
              applyKey(key);
              onPreset?.(key);
            }}
            className="min-h-8 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2.5 text-[11px] text-[var(--foreground)] transition hover:border-[var(--primary)]/60 hover:text-[var(--primary)]"
          >
            {p.label}
          </button>
        ))}
      </div>
      <WheelGroup
        headers={["วัน", "เดือน", era === "BE" ? "พ.ศ." : "ค.ศ."]}
        hint="พิมพ์ที่ช่องบนได้เลย ไม่ต้องเลื่อนหา"
      >
        <WheelColumn
          options={dayOptions}
          value={safeDay}
          onChange={(next) => {
            setDay(next);
            pushWheels(next, month, year);
          }}
          ariaLabel="วันที่จร"
        />
        <WheelColumn
          options={monthOptions}
          value={month}
          onChange={(next) => {
            setMonth(next);
            pushWheels(safeDay, next, year);
          }}
          ariaLabel="เดือนจร"
        />
        <WheelColumn
          options={yearOptions}
          value={year}
          onChange={(next) => {
            setYear(next);
            pushWheels(safeDay, month, next);
          }}
          ariaLabel="ปีจร"
        />
      </WheelGroup>
    </div>
  );
}

export function TransitDatePicker({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const draftRef = useRef<string | null>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; bottom: number; width: number } | null>(
    null,
  );

  function openPanel() {
    draftRef.current = null;
    setOpen(true);
  }

  useLayoutEffect(() => {
    if (!open) return;
    function place() {
      const el = buttonRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const width = Math.min(340, window.innerWidth - 24);
      let left = r.right - width;
      if (left < 12) left = 12;
      if (left + width > window.innerWidth - 12) {
        left = window.innerWidth - width - 12;
      }
      setPos({
        left,
        bottom: window.innerHeight - r.top + 8,
        width,
      });
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  function closePanel(commit: boolean) {
    if (commit && draftRef.current) onChange(draftRef.current);
    draftRef.current = null;
    setOpen(false);
  }

  const closePanelRef = useRef(closePanel);
  useEffect(() => {
    closePanelRef.current = closePanel;
  });

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    let remove: (() => void) | undefined;
    const timer = window.setTimeout(() => {
      if (!mounted) return;
      function onPointerDown(e: PointerEvent) {
        const t = e.target as Node;
        if (panelRef.current?.contains(t) || buttonRef.current?.contains(t)) {
          return;
        }
        closePanelRef.current(true);
      }
      function onKey(e: KeyboardEvent) {
        if (e.key === "Escape") closePanelRef.current(false);
      }
      document.addEventListener("pointerdown", onPointerDown);
      document.addEventListener("keydown", onKey);
      remove = () => {
        document.removeEventListener("pointerdown", onPointerDown);
        document.removeEventListener("keydown", onKey);
      };
    }, 0);
    return () => {
      mounted = false;
      window.clearTimeout(timer);
      remove?.();
    };
  }, [open]);

  const label = value ? transitDateLabelFromKey(value) : null;

  const panel =
    open && pos && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-label="เลือกวันจร"
            style={{ left: pos.left, bottom: pos.bottom, width: pos.width }}
            className="fixed z-50 max-h-[min(32rem,calc(100dvh-5.5rem))] overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-2xl"
          >
            <TransitDateWheel
              value={value}
              hint="พิมพ์วันที่ หรือหมุนวงล้อ — เว้นว่างถ้าให้ระบบอ่านจากคำถาม"
              onChange={(key) => {
                draftRef.current = key;
              }}
              onPreset={(key) => {
                onChange(key);
                draftRef.current = null;
                setOpen(false);
              }}
              onSubmit={(key) => {
                onChange(key);
                draftRef.current = null;
                setOpen(false);
              }}
            />
            <div className="mt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  draftRef.current = null;
                  setOpen(false);
                }}
                className="min-h-8 px-1 text-[12px] text-[var(--muted)] underline-offset-2 hover:text-[var(--foreground)] hover:underline"
              >
                ล้าง — ให้อ่านจากคำถาม
              </button>
              <button
                type="button"
                onClick={() => closePanel(true)}
                className="min-h-8 rounded-lg bg-[var(--primary)] px-3 text-[12px] font-semibold text-[var(--primary-foreground)]"
              >
                ตกลง
              </button>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={
          label
            ? `วันจร ${label}`
            : "เลือกวันจร ว่างไว้ให้ระบบถอดจากคำถาม"
        }
        onClick={() => {
          if (open) closePanel(true);
          else openPanel();
        }}
        className="flex min-h-9 max-w-[16rem] items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 text-left text-[12px] text-[var(--muted)] transition hover:border-[var(--primary)]/50 disabled:opacity-50"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0 text-[var(--primary)]"
          aria-hidden
        >
          <rect x="3" y="5" width="18" height="16" rx="3" />
          <path d="M3 10h18M8 3v4M16 3v4" />
        </svg>
        {label ? (
          <span className="min-w-0 truncate font-medium tabular-nums text-[var(--foreground)]">
            {label}
          </span>
        ) : (
          <span className="min-w-0 truncate">เลือกวันที่ต้องการเช็คดวง</span>
        )}
      </button>
      {panel}
    </div>
  );
}

function EraChip({
  era,
  value,
  label,
  onSelect,
}: {
  era: Era;
  value: Era;
  label: string;
  onSelect: (next: Era) => void;
}) {
  const active = era === value;
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      aria-pressed={active}
      className={`min-h-7 rounded-md px-2 text-[11px] transition ${
        active
          ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
          : "text-[var(--muted)] hover:text-[var(--foreground)]"
      }`}
    >
      {label}
    </button>
  );
}
