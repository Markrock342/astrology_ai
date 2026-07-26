"use client";

import Link from "next/link";
import { useAppData } from "./app-data-provider";
import { PRO_EXPIRY_WARN_DAYS } from "@/config/constants";

/** Light banner when Pro expires within PRO_EXPIRY_WARN_DAYS. */
export function ProExpiryBanner() {
  const { user } = useAppData();
  if (user?.plan !== "PRO" || !user.proExpiresAt) return null;

  const daysLeft = Math.ceil(
    (new Date(user.proExpiresAt).getTime() - Date.now()) /
      (24 * 60 * 60 * 1000),
  );
  if (daysLeft < 0 || daysLeft > PRO_EXPIRY_WARN_DAYS) return null;

  const label = new Date(user.proExpiresAt).toLocaleDateString("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="border-b border-[var(--primary)]/30 bg-[var(--primary)]/8 px-4 py-2.5 md:px-6">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2 text-sm">
        <p className="text-[var(--foreground)]">
          Pro ใกล้หมดอายุ {label} (เหลือ {daysLeft} วัน)
        </p>
        <Link
          href="/account#payment"
          className="font-semibold text-[var(--primary)] underline"
        >
          ต่ออายุ
        </Link>
      </div>
    </div>
  );
}
