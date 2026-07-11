"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Announcement = {
  id: string;
  title: string;
  message: string;
  tone: "INFO" | "WARNING" | "PROMO" | "DANGER";
  linkUrl: string | null;
  linkLabel: string | null;
};

const TONE_CLASS: Record<Announcement["tone"], string> = {
  INFO: "border-[var(--primary)]/30 bg-[var(--primary)]/10 text-[var(--foreground)]",
  WARNING: "border-amber-500/40 bg-amber-500/10 text-amber-100",
  PROMO: "border-[var(--secondary-active)]/40 bg-[var(--secondary-active)]/10 text-[var(--foreground)]",
  DANGER: "border-[var(--danger)]/40 bg-[var(--danger)]/10 text-[var(--danger)]",
};

export function SiteAnnouncementBanner() {
  const [items, setItems] = useState<Announcement[]>([]);

  useEffect(() => {
    fetch("/api/announcements")
      .then((r) => r.json())
      .then((body) => {
        if (body?.ok && Array.isArray(body.data)) setItems(body.data);
      })
      .catch(() => {});
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="flex flex-col gap-1 border-b border-[var(--border)] px-4 py-2">
      {items.map((item) => (
        <div
          key={item.id}
          className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs ${TONE_CLASS[item.tone]}`}
        >
          <div>
            <span className="font-medium">{item.title}</span>
            <span className="mx-2 opacity-40">·</span>
            <span>{item.message}</span>
          </div>
          {item.linkUrl && (
            <Link
              href={item.linkUrl}
              className="shrink-0 underline-offset-2 hover:underline"
            >
              {item.linkLabel ?? "ดูรายละเอียด"}
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}
