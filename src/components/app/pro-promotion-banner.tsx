"use client";

import { useAppData } from "./app-data-provider";

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  }).format(new Date(iso));
}

export function ProPromotionBanner() {
  const { user } = useAppData();
  if (!user?.promotionEndsAt) return null;

  return (
    <div className="shrink-0 border-b border-[var(--primary)]/25 bg-[var(--primary)]/10 px-4 py-2 text-center text-xs leading-5 text-[var(--foreground)]">
      <span className="font-semibold text-[var(--primary)]">Pro เปิดครบทุกหมวด</span>
      <span>
        {" "}ถึง {formatDate(user.promotionEndsAt)}
        {user.promotionCreditGrant
          ? ` · เพิ่ม usage ให้ ${user.promotionCreditGrant}% แล้ว`
          : ""}
      </span>
    </div>
  );
}
