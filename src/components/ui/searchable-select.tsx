"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

type SearchableSelectProps = {
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  placeholder: string;
  ariaLabel: string;
  disabled?: boolean;
  emptyLabel?: string;
  className?: string;
};

function normalized(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("th")
    .replace(/^(?:จังหวัด|จ\.|อำเภอ|อ\.|เขต)\s*/u, "")
    .replace(/\s+/g, "");
}

export function filterSearchableOptions(
  options: readonly string[],
  query: string,
): string[] {
  const needle = normalized(query);
  if (!needle) return [...options];
  return options.filter((option) => normalized(option).includes(needle));
}

/**
 * Accessible searchable single-select. Users can type a province/district,
 * navigate results with the keyboard, or tap an option on mobile.
 */
export function SearchableSelect({
  value,
  options,
  onChange,
  placeholder,
  ariaLabel,
  disabled = false,
  emptyLabel,
  className,
}: SearchableSelectProps) {
  const reactId = useId();
  const listboxId = `${reactId}-listbox`;
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const filtered = useMemo(
    () => filterSearchableOptions(options, query),
    [options, query],
  );

  useEffect(() => {
    function closeWhenClickingOutside(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
        setQuery(value);
      }
    }
    document.addEventListener("pointerdown", closeWhenClickingOutside);
    return () => document.removeEventListener("pointerdown", closeWhenClickingOutside);
  }, [value]);

  function choose(next: string) {
    onChange(next);
    setQuery(next);
    setOpen(false);
    setActiveIndex(-1);
  }

  const resultCount = filtered.length + (emptyLabel ? 1 : 0);
  const activeOptionId =
    open && activeIndex >= 0 ? `${reactId}-option-${activeIndex}` : undefined;

  return (
    <div ref={rootRef} className={`relative ${className ?? ""}`}>
      <div className="relative">
        <input
          type="text"
          role="combobox"
          aria-label={ariaLabel}
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={activeOptionId}
          autoComplete="off"
          disabled={disabled}
          value={open ? query : value}
          placeholder={placeholder}
          onFocus={(event) => {
            setQuery(value);
            setOpen(true);
            event.currentTarget.select();
          }}
          onChange={(event) => {
            const next = event.target.value;
            setQuery(next);
            setOpen(true);
            setActiveIndex(-1);
            if (!next && emptyLabel) onChange("");
            const exact = options.find(
              (option) => normalized(option) === normalized(next),
            );
            if (exact) onChange(exact);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setOpen(true);
              setActiveIndex((index) => Math.min(index + 1, resultCount - 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setOpen(true);
              setActiveIndex((index) => Math.max(index - 1, 0));
            } else if (event.key === "Enter" && open && activeIndex >= 0) {
              event.preventDefault();
              if (emptyLabel && activeIndex === 0) choose("");
              else choose(filtered[activeIndex - (emptyLabel ? 1 : 0)] ?? value);
            } else if (event.key === "Escape") {
              setOpen(false);
              setActiveIndex(-1);
              setQuery(value);
            } else if (event.key === "Tab") {
              const exact = options.find(
                (option) => normalized(option) === normalized(query),
              );
              setQuery(exact ?? value);
              setOpen(false);
            }
          }}
          className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 pr-10 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted-2)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-50"
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label={open ? `ปิดรายการ${ariaLabel}` : `เปิดรายการ${ariaLabel}`}
          disabled={disabled}
          onClick={() => {
            if (!open) setQuery(value);
            setOpen((current) => !current);
          }}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-[var(--primary)] disabled:opacity-40"
        >
          <svg
            aria-hidden="true"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="currentColor"
            className={`transition-transform ${open ? "rotate-180" : ""}`}
          >
            <path d="M12 16L4 7h16z" />
          </svg>
        </button>
      </div>

      {open && !disabled ? (
        <ul
          id={listboxId}
          role="listbox"
          aria-label={`ผลการค้นหา${ariaLabel}`}
          className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto overscroll-contain rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1 shadow-2xl"
        >
          {emptyLabel ? (
            <li
              id={`${reactId}-option-0`}
              role="option"
              aria-selected={!value}
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => choose("")}
              className={`cursor-pointer rounded-lg px-3 py-2.5 text-sm ${
                activeIndex === 0
                  ? "bg-[var(--primary)]/15 text-[var(--primary)]"
                  : "text-[var(--muted)] hover:bg-[var(--surface-2)]"
              }`}
            >
              {emptyLabel}
            </li>
          ) : null}
          {filtered.map((option, index) => {
            const optionIndex = index + (emptyLabel ? 1 : 0);
            const selected = option === value;
            return (
              <li
                id={`${reactId}-option-${optionIndex}`}
                key={option}
                role="option"
                aria-selected={selected}
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => choose(option)}
                className={`cursor-pointer rounded-lg px-3 py-2.5 text-sm ${
                  activeIndex === optionIndex || selected
                    ? "bg-[var(--primary)]/15 text-[var(--primary)]"
                    : "text-[var(--foreground)] hover:bg-[var(--surface-2)]"
                }`}
              >
                {option}
              </li>
            );
          })}
          {!filtered.length && !emptyLabel ? (
            <li className="px-3 py-3 text-sm text-[var(--muted)]">
              ไม่พบรายการที่พิมพ์
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
