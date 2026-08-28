"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CmsPaymentInfo } from "@/lib/cms-keys";
import { Button, Field, TextInput } from "@/components/admin/ui";
import { useAppData } from "@/components/app/app-data-provider";
import { PAYMENT_PENDING_SLA_HOURS } from "@/config/constants";
import { isPaymentInfoConfigured } from "@/lib/payment-info";

type PaymentRow = {
  id: string;
  amount: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  /** User note on submit; for REJECTED rows may hold admin review reason until BE-E2.3 adds reviewNote. */
  note: string | null;
  /** Optional admin review reason (BE-E2.3). */
  reviewNote?: string | null;
  proofUrl: string | null;
  reviewedAt: string | null;
  createdAt: string;
};

function slipSrc(p: PaymentRow): string | null {
  if (!p.proofUrl) return null;
  if (/^https?:\/\//i.test(p.proofUrl)) return p.proofUrl;
  return `/api/payments/proof/${p.id}`;
}

function adminReviewMessage(p: PaymentRow): string | null {
  if (p.status !== "REJECTED") return null;
  const msg = p.reviewNote?.trim() || p.note?.trim();
  return msg || null;
}

const STATUS_TH: Record<PaymentRow["status"], string> = {
  PENDING: "รออนุมัติ",
  APPROVED: "อนุมัติแล้ว",
  REJECTED: "ปฏิเสธ",
};

function RejectedPaymentCard({
  payment,
  onResubmit,
}: {
  payment: PaymentRow;
  onResubmit: () => void;
}) {
  const reason = adminReviewMessage(payment);
  const slip = slipSrc(payment);
  const [slipBroken, setSlipBroken] = useState(false);

  return (
    <div className="mt-4 rounded-xl border border-[var(--danger)]/40 bg-[var(--danger)]/10 p-4">
      <p className="text-sm font-semibold text-[var(--danger)]">
        การชำระเงินถูกปฏิเสธ
      </p>
      <p className="mt-1 text-xs text-[var(--muted)]">
        จำนวน ฿{payment.amount}
        {payment.reviewedAt
          ? ` · ตรวจเมื่อ ${new Date(payment.reviewedAt).toLocaleString("th-TH")}`
          : ""}
      </p>
      {reason ? (
        <p className="mt-3 rounded-lg bg-[var(--surface)]/80 px-3 py-2 text-sm text-[var(--foreground)]">
          <span className="text-[var(--muted)]">เหตุผลจากแอดมิน: </span>
          {reason}
        </p>
      ) : (
        <p className="mt-3 text-xs text-[var(--muted-2)]">
          แอดมินไม่ได้ระบุเหตุผล — ลองส่งสลิปใหม่หรือติดต่อทีมงาน
        </p>
      )}
      {slip && !slipBroken ? (
        <a
          href={slip}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-block overflow-hidden rounded-lg border border-[var(--border)]"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={slip}
            alt="สลิปที่ถูกปฏิเสธ"
            className="max-h-40 max-w-full object-contain"
            onError={() => setSlipBroken(true)}
          />
        </a>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onResubmit}
          className="press-scale rounded-xl bg-[var(--primary)] px-4 py-2 text-xs font-semibold text-[var(--primary-foreground)] transition hover:bg-[var(--primary-hover)]"
        >
          ส่งสลิปใหม่
        </button>
        <Link
          href="/contact"
          className="press-scale rounded-xl border border-[var(--border)] px-4 py-2 text-xs font-semibold text-[var(--foreground)] transition hover:border-[var(--primary)]"
        >
          ติดต่อทีมงาน
        </Link>
      </div>
    </div>
  );
}

export function PaymentSubmitCard({
  proPrice,
  paymentInfo,
  variant = "upgrade",
  usagePercent,
  currentUsagePercent,
}: {
  proPrice: number;
  paymentInfo: CmsPaymentInfo;
  /** `upgrade` = Free→Pro; `renew` = extend Pro; `topup` = usage refill. */
  variant?: "upgrade" | "renew" | "topup";
  usagePercent?: number;
  currentUsagePercent?: number;
}) {
  const { refresh } = useAppData();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [history, setHistory] = useState<PaymentRow[]>([]);
  const [nowMs] = useState(() => Date.now());
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const amount = proPrice;

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/payments/me");
      const json = await res.json();
      if (json.ok) setHistory(json.data as PaymentRow[]);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadHistory();
  }, [loadHistory]);

  function onPickFile(f: File | null) {
    setFile(f);
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return f ? URL.createObjectURL(f) : null;
    });
  }

  function scrollToForm() {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => inputRef.current?.focus(), 300);
  }

  const isTopUp = variant === "topup";
  const isRenew = variant === "renew";
  const paymentConfigured = isPaymentInfoConfigured(paymentInfo);
  const topUpPercent = usagePercent ?? 50;
  const remainingPercent = currentUsagePercent ?? 0;
  const projectedPercent = remainingPercent + topUpPercent;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("กรุณาอัปโหลดรูปสลิปจากเครื่อง");
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(false);
    try {
      const form = new FormData();
      form.append("file", file);
      const up = await fetch("/api/payments/proof", { method: "POST", body: form });
      const upJson = await up.json();
      if (!up.ok || !upJson?.ok) {
        throw new Error(upJson?.error?.message ?? "อัปโหลดสลิปไม่สำเร็จ");
      }
      const proofPath = upJson.data.pathname as string;

      const res = await fetch("/api/payments/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          packageCode: isTopUp ? "CREDIT_TOPUP" : "PRO",
          proofPath,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message ?? "ส่งไม่สำเร็จ");
      setSuccess(true);
      onPickFile(null);
      if (inputRef.current) inputRef.current.value = "";
      await loadHistory();
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ส่งไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  const pending = history.find((p) => p.status === "PENDING");
  const pendingOverdue =
    pending != null &&
    nowMs - new Date(pending.createdAt).getTime() >
      PAYMENT_PENDING_SLA_HOURS * 60 * 60 * 1000;
  const latestRejected = !pending
    ? history.find((p) => p.status === "REJECTED")
    : undefined;
  const cardTitle = isTopUp
    ? "เติม usage เพิ่ม"
    : isRenew
      ? "ต่ออายุสมาชิก Pro"
      : paymentInfo.title;
  const submitLabel = busy
    ? "กำลังส่ง…"
    : latestRejected
      ? isTopUp
        ? `ส่งสลิปใหม่เพื่อรับ +${topUpPercent}%`
        : "ส่งสลิปใหม่"
      : isTopUp
        ? `ส่งสลิปเพื่อรับ +${topUpPercent}%`
        : isRenew
          ? "แจ้งชำระต่ออายุ Pro"
          : "แจ้งชำระเงิน";

  // Soften Pro-centric CMS copy on topup/renew (amountNote defaults to "แพ็กเกจ Pro").
  const amountNote = isTopUp
    ? `ยอดที่ต้องโอน: ${amount} บาท`
    : isRenew
      ? `โอนตามยอดต่ออายุ Pro (${amount} บาท)`
      : paymentInfo.amountNote;
  const displaySteps = paymentInfo.steps.map((step) => {
    let text = step.replaceAll("{price}", String(proPrice));
    if (isTopUp) {
      text = text
        .replaceAll("แพ็กเกจ Pro", "เติม usage")
        .replaceAll("อัปเกรด Pro", "เติม usage")
        .replaceAll("เติมเครดิต", "เติม usage");
    } else if (isRenew) {
      text = text.replaceAll("อัปเกรด Pro", "ต่ออายุ Pro");
    }
    return text;
  });

  return (
    <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
      {isTopUp ? (
        <>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.12em] text-[var(--primary)]">
                TOP-UP USAGE
              </p>
              <h2 className="mt-1 text-xl font-semibold text-[var(--foreground)]">
                เติม usage เพื่อใช้ AI ต่อ
              </h2>
              <p className="mt-1 max-w-xl text-sm leading-6 text-[var(--muted)]">
                จ่ายครั้งเดียว ได้ usage เพิ่มเท่ากับครึ่งหนึ่งของโควตา Pro ต่อรอบ
              </p>
            </div>
            <div className="grid grid-cols-[auto_auto_auto] items-center gap-x-3 self-start sm:self-auto">
              <div className="text-right">
                <p className="text-[11px] text-[var(--muted-2)]">โอน</p>
                <p className="tabular-nums text-2xl font-semibold text-[var(--foreground)]">
                  ฿{amount}
                </p>
              </div>
              <span aria-hidden className="text-lg text-[var(--primary)]">→</span>
              <div>
                <p className="text-[11px] text-[var(--muted-2)]">ได้รับ</p>
                <p className="tabular-nums text-2xl font-semibold text-[var(--primary)]">
                  +{topUpPercent}%
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-y border-[var(--border)] py-4">
            <div>
              <p className="text-[11px] text-[var(--muted-2)]">usage ตอนนี้</p>
              <p className="tabular-nums text-lg font-semibold text-[var(--foreground)]">
                {remainingPercent}%
              </p>
            </div>
            <span aria-hidden className="text-[var(--muted-2)]">→</span>
            <div>
              <p className="text-[11px] text-[var(--muted-2)]">หลังแอดมินอนุมัติ</p>
              <p className="tabular-nums text-lg font-semibold text-[var(--primary)]">
                {projectedPercent}%
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs leading-5 text-[var(--muted)]">
            ยอดนี้บวกเพิ่มจากยอดปัจจุบัน ไม่ได้เติมให้เต็ม 100% และจะไม่หายเมื่อต่ออายุ Pro
          </p>
        </>
      ) : (
        <>
          <h2 className="text-sm font-semibold text-[var(--foreground)]">{cardTitle}</h2>
          {isRenew ? (
            <p className="mt-2 text-xs text-[var(--muted)]">
              โอนตามยอดแพ็ก Pro เพื่อต่ออายุสมาชิกอีก 30 วัน และเริ่ม usage รอบใหม่
            </p>
          ) : null}
        </>
      )}

      {paymentConfigured ? (
        <section className="mt-6 border-t border-[var(--border)] pt-5">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">
            {isTopUp ? `1. โอนเงิน ${amount} บาท` : "โอนเงินเข้าบัญชีนี้"}
          </h3>
          <dl className="mt-3 grid gap-1.5 text-sm text-[var(--muted)]">
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-[var(--muted-2)]">ธนาคาร</dt>
              <dd className="text-[var(--foreground)]">{paymentInfo.bankName}</dd>
            </div>
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-[var(--muted-2)]">ชื่อบัญชี</dt>
              <dd>{paymentInfo.accountName}</dd>
            </div>
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-[var(--muted-2)]">เลขบัญชี</dt>
              <dd className="font-mono font-medium text-[var(--primary)]">{paymentInfo.accountNumber}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-[var(--muted)]">{amountNote}</p>
          {!isTopUp && displaySteps.length > 0 ? (
            <ol className="mt-4 list-decimal space-y-1.5 pl-5 text-xs leading-5 text-[var(--muted)]">
              {displaySteps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          ) : null}
          {paymentInfo.footer ? (
            <p className="mt-4 text-[11px] text-[var(--muted-2)]">{paymentInfo.footer}</p>
          ) : null}
        </section>
      ) : (
        <div role="alert" className="mt-6 rounded-xl border border-[var(--danger)]/40 bg-[var(--danger)]/10 p-4">
          <p className="text-sm font-semibold text-[var(--foreground)]">ยังไม่เปิดรับโอนเงิน</p>
          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
            ทีมงานยังไม่ได้ตั้งค่าบัญชีรับเงินจริง จึงยังส่งสลิปไม่ได้ กรุณาติดต่อทีมงานก่อนโอนเงิน
          </p>
        </div>
      )}

      {pending ? (
        <div className="mt-4 rounded-xl border border-[var(--primary)]/35 bg-[var(--primary)]/10 p-4">
          <p className="text-sm font-semibold text-[var(--primary)]">
            {isTopUp
              ? `รอแอดมินตรวจสลิปเพื่อเพิ่ม +${topUpPercent}%`
              : "รอแอดมินตรวจสอบการชำระเงิน"}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            จำนวน ฿{pending.amount} · ส่งเมื่อ{" "}
            {new Date(pending.createdAt).toLocaleString("th-TH")}
          </p>
          {pending.proofUrl ? (
            <a
              href={slipSrc(pending) ?? "#"}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-block overflow-hidden rounded-lg border border-[var(--border)]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={slipSrc(pending) ?? undefined}
                alt="สลิปที่ส่งแล้ว"
                className="max-h-40 max-w-full object-contain"
              />
            </a>
          ) : null}
          <p className="mt-3 text-[11px] text-[var(--muted-2)]">
            {pendingOverdue
              ? "เกินเวลาปกติแล้ว — ติดต่อทีมงานที่ /contact หากยังไม่ได้รับการอัปเดต"
              : "ปกติภายใน 1–2 วันทำการ · ไม่สามารถส่งคำขอใหม่ได้จนกว่าแอดมินจะอนุมัติหรือปฏิเสธ"}
          </p>
        </div>
      ) : paymentConfigured ? (
        <>
          {latestRejected ? (
            <RejectedPaymentCard
              payment={latestRejected}
              onResubmit={scrollToForm}
            />
          ) : null}
          <form
            id="payment-form"
            ref={formRef}
            onSubmit={submit}
            className="mt-4 grid gap-3"
          >
            {!isTopUp ? (
              <Field
                label="จำนวนเงิน (บาท)"
                hint="โอนตามยอดนี้เท่านั้น — ระบบล็อกตามแพ็กเกจ"
              >
                <TextInput
                  type="number"
                  value={amount}
                  readOnly
                  className="opacity-90"
                />
              </Field>
            ) : null}
            <Field
              label={isTopUp ? "2. แนบสลิปการโอน" : "อัปโหลดสลิปจากเครื่อง"}
              hint="JPG / PNG / WebP สูงสุด 2 MB"
            >
              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="block w-full text-xs text-[var(--muted)] file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--surface-3)] file:px-3 file:py-2 file:text-xs file:font-medium file:text-[var(--foreground)]"
                onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
              />
            </Field>
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt="ตัวอย่างสลิป"
                className="max-h-48 rounded-lg border border-[var(--border)] object-contain"
              />
            ) : null}
            <div className="mt-1">
              {error && (
                <p role="alert" className="mb-2 text-xs text-[var(--danger)]">
                  {error}
                </p>
              )}
              {success && (
                <p className="mb-2 text-xs text-[var(--secondary-active)]">
                  ส่งคำขอแล้ว — รอแอดมินตรวจสอบ
                </p>
              )}
              <p className="mb-2 text-xs text-[var(--muted)]">
                {isTopUp
                  ? "3. ส่งสลิปให้แอดมินตรวจสอบ (ปกติ 1–2 วันทำการ)"
                  : "แอดมินจะตรวจสอบสลิปภายใน 1–2 วันทำการ"}
              </p>
              <Button type="submit" disabled={busy || !file}>
                {submitLabel}
              </Button>
            </div>
          </form>
        </>
      ) : null}

      {history.length > 0 && (
        <ul className="mt-6 space-y-2 border-t border-[var(--border)] pt-4">
          {history.slice(0, 5).map((p) => (
            <li key={p.id} className="text-xs text-[var(--muted)]">
              <div className="flex justify-between gap-2">
                <span>
                  ฿{p.amount} · {STATUS_TH[p.status]}
                </span>
                <span className="shrink-0">
                  {new Date(p.createdAt).toLocaleDateString("th-TH")}
                </span>
              </div>
              {p.status === "REJECTED" && adminReviewMessage(p) ? (
                <p className="mt-0.5 truncate text-[10px] text-[var(--danger)]">
                  {adminReviewMessage(p)}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
