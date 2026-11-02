"use client";

import { useState } from "react";
import { Button, TextInput } from "./ui";

export function SortableTh({ label, active, direction, onClick }: {
  label: string; active: boolean; direction: "asc" | "desc"; onClick: () => void;
}) {
  return <th scope="col" aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}
    className="whitespace-nowrap border-b border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-xs font-medium text-[var(--muted)]">
    <button type="button" onClick={onClick} className="min-h-11 text-left hover:text-[var(--primary)] focus-visible:outline-2">
      {label} <span aria-hidden="true">{active ? (direction === "asc" ? "↑" : "↓") : "↕"}</span>
    </button>
  </th>;
}

export function PageJump({ page, totalPages, disabled, onPage }: {
  page: number; totalPages: number; disabled: boolean; onPage: (page: number) => void;
}) {
  const [value, setValue] = useState(String(page));
  return <form className="flex shrink-0 items-center gap-2 whitespace-nowrap" onSubmit={(e) => {
    e.preventDefault();
    const next = Number(value);
    if (Number.isInteger(next) && next >= 1 && next <= totalPages) onPage(next);
  }}>
    <span className="text-xs text-[var(--muted)]">หน้าที่</span>
    <TextInput aria-label="ไปหน้าที่" type="number" min={1} max={totalPages} step={1} required
      disabled={disabled} value={value} onChange={(e) => setValue(e.target.value)} className="w-20" />
    <span className="text-xs text-[var(--muted)]">/ {totalPages}</span>
    <Button type="submit" variant="ghost" disabled={disabled}>ไป</Button>
  </form>;
}
