"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CmsPaymentInfo } from "@/lib/cms-keys";
import { Button, Field, TextInput } from "@/components/admin/ui";
import { useAppData } from "@/components/app/app-data-provider";

type PaymentRow = {
  id: string;
  amount: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reference: string | null;
  note: string | null;
  proofUrl: string | null;
  reviewedAt: string | null;
  createdAt: string;
};

function slipSrc(p: PaymentRow): string | null {
  if (!p.proofUrl) return null;
  if (/^https?:\/\//i.test(p.proofUrl)) return p.proofUrl;
  return `/api/payments/proof/${p.id}`;
}

const STATUS_TH: Record<PaymentRow["status"], string> = {
  PENDING: "รออนุมัติ",
  APPROVED: "อนุมัติแล้ว",
  REJECTED: "ปฏิเสธ",
};

export function PaymentSubmitCard({
  proPrice,
  paymentInfo,
}: {
  proPrice: number;
  paymentInfo: CmsPaymentInfo;
}) {
  const { refresh } = useAppData();
  const [amount, setAmount] = useState(proPrice);
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [history, setHistory] = useState<PaymentRow[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/payments/me");
      const json = await res.json();
      if (json.ok) setHistory(json.data);
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
          reference: reference || undefined,
          note: note || undefined,
          proofPath,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message ?? "ส่งไม่สำเร็จ");
      setSuccess(true);
      setReference("");
      setNote("");
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

  return (
    <div id="payment" className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
      <h2 className="text-sm font-semibold text-[var(--foreground)]">
        {paymentInfo.title}
      </h2>
      <div className="mt-3 rounded-xl bg-[var(--surface-2)] p-4 text-sm text-[var(--muted)]">
        <p>
          <span className="text-[var(--foreground)]">{paymentInfo.bankName}</span>
          {" · "}
          {paymentInfo.accountName}
        </p>
        <p className="mt-1 font-mono text-[var(--primary)]">{paymentInfo.accountNumber}</p>
        <p className="mt-2 text-xs">{paymentInfo.amountNote}</p>
        <ol className="mt-3 list-inside list-decimal space-y-1 text-xs">
          {paymentInfo.steps.map((step, i) => (
            <li key={i}>{step.replaceAll("{price}", String(proPrice))}</li>
          ))}
        </ol>
        {paymentInfo.footer && (
          <p className="mt-3 text-[10px] text-[var(--muted-2)]">{paymentInfo.footer}</p>
        )}
      </div>

      {pending ? (
        <div className="mt-4 rounded-xl border border-[var(--primary)]/35 bg-[var(--primary)]/10 p-4">
          <p className="text-sm font-semibold text-[var(--primary)]">
            รอแอดมินตรวจสอบการชำระเงิน
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            จำนวน ฿{pending.amount} · ส่งเมื่อ{" "}
            {new Date(pending.createdAt).toLocaleString("th-TH")}
            {pending.reference ? ` · อ้างอิง ${pending.reference}` : ""}
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
            ปกติภายใน 1–2 วันทำการ · ไม่สามารถส่งคำขอใหม่ได้จนกว่าแอดมินจะอนุมัติหรือปฏิเสธ
            {paymentInfo.footer ? ` · ${paymentInfo.footer}` : ""}
          </p>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="จำนวนเงิน (บาท)">
            <TextInput
              type="number"
              min={1}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
          </Field>
          <Field label="เลขอ้างอิง / เลขที่สลิป">
            <TextInput
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="REF123456"
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="อัปโหลดสลิปจากเครื่อง" hint="JPG / PNG / WebP สูงสุด 2 MB">
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
                className="mt-2 max-h-48 rounded-lg border border-[var(--border)] object-contain"
              />
            ) : null}
          </div>
          <Field label="หมายเหตุ">
            <TextInput
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
          <div className="sm:col-span-2">
            {error && <p className="mb-2 text-xs text-[var(--danger)]">{error}</p>}
            {success && (
              <p className="mb-2 text-xs text-[var(--secondary-active)]">
                ส่งคำขอแล้ว — รอแอดมินตรวจสอบ
              </p>
            )}
            <Button type="submit" disabled={busy || !file}>
              {busy ? "กำลังส่ง…" : "แจ้งชำระเงิน"}
            </Button>
          </div>
        </form>
      )}

      {history.length > 0 && (
        <ul className="mt-6 space-y-2 border-t border-[var(--border)] pt-4">
          {history.slice(0, 5).map((p) => (
            <li
              key={p.id}
              className="flex justify-between text-xs text-[var(--muted)]"
            >
              <span>
                ฿{p.amount} · {STATUS_TH[p.status]}
                {p.reference ? ` · ${p.reference}` : ""}
              </span>
              <span>{new Date(p.createdAt).toLocaleDateString("th-TH")}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
