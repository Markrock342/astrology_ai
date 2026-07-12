"use client";

import Link from "next/link";
import { useAppData } from "./app-data-provider";

/** Persistent banner while a manual payment slip awaits admin review. */
export function PendingPaymentBanner() {
  const { pendingPayment } = useAppData();
  if (!pendingPayment) return null;

  return (
    <div className="border-b border-[var(--primary)]/35 bg-[var(--primary)]/10 px-4 py-3 md:px-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[var(--foreground)]">
          รอแอดมินตรวจสอบการชำระเงิน{" "}
          <span className="font-semibold text-[var(--primary)]">
            ฿{pendingPayment.amount}
          </span>
          {" · "}
          <span className="text-[var(--muted)]">ปกติภายใน 1–2 วันทำการ</span>
        </p>
        <Link
          href="/account#payment"
          className="press-scale shrink-0 rounded-lg border border-[var(--primary)]/40 px-3 py-1.5 text-xs font-medium text-[var(--primary)] transition hover:bg-[var(--primary)]/10"
        >
          ดูสถานะ
        </Link>
      </div>
    </div>
  );
}
