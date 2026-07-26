"use client";

import Link from "next/link";
import { useAppData } from "./app-data-provider";
import { PAYMENT_PENDING_SLA_HOURS } from "@/config/constants";

/** Persistent banner while a manual payment slip awaits admin review. */
export function PendingPaymentBanner() {
  const { pendingPayment } = useAppData();
  if (!pendingPayment) return null;

  const ageMs = Date.now() - new Date(pendingPayment.createdAt).getTime();
  const overdue = ageMs > PAYMENT_PENDING_SLA_HOURS * 60 * 60 * 1000;

  return (
    <div
      className={`border-b px-4 py-3 md:px-6 ${
        overdue
          ? "border-[var(--danger)]/35 bg-[var(--danger)]/10"
          : "border-[var(--primary)]/35 bg-[var(--primary)]/10"
      }`}
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[var(--foreground)]">
          รอแอดมินตรวจสอบการชำระเงิน{" "}
          <span className="font-semibold text-[var(--primary)]">
            ฿{pendingPayment.amount}
          </span>
          {" · "}
          {overdue ? (
            <span className="text-[var(--danger)]">
              เกินเวลาปกติ (1–2 วันทำการ) — ติดต่อทีมงานได้ที่หน้าติดต่อ
            </span>
          ) : (
            <span className="text-[var(--muted)]">ปกติภายใน 1–2 วันทำการ</span>
          )}
        </p>
        <div className="flex shrink-0 gap-2">
          {overdue ? (
            <Link
              href="/contact"
              className="press-scale rounded-lg border border-[var(--danger)]/40 px-3 py-1.5 text-xs font-medium text-[var(--danger)] transition hover:bg-[var(--danger)]/10"
            >
              ติดต่อ
            </Link>
          ) : null}
          <Link
            href="/account#payment"
            className="press-scale rounded-lg border border-[var(--primary)]/40 px-3 py-1.5 text-xs font-medium text-[var(--primary)] transition hover:bg-[var(--primary)]/10"
          >
            ดูสถานะ
          </Link>
        </div>
      </div>
    </div>
  );
}
