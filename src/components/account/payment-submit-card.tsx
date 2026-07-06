"use client";

import { useCallback, useEffect, useState } from "react";
import type { CmsPaymentInfo } from "@/lib/cms-keys";
import { Button, Field, TextInput } from "@/components/admin/ui";

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

export function PaymentSubmitCard({
  proPrice,
  paymentInfo,
}: {
  proPrice: number;
  paymentInfo: CmsPaymentInfo;
}) {
  const [amount, setAmount] = useState(proPrice);
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [history, setHistory] = useState<PaymentRow[]>([]);

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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch("/api/payments/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          reference: reference || undefined,
          note: note || undefined,
          proofUrl: proofUrl || undefined,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message ?? "ส่งไม่สำเร็จ");
      setSuccess(true);
      setReference("");
      setNote("");
      setProofUrl("");
      await loadHistory();
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
            <li key={i}>{step.replace(/\d+/, String(proPrice))}</li>
          ))}
        </ol>
        {paymentInfo.footer && (
          <p className="mt-3 text-[10px] text-[var(--muted-2)]">{paymentInfo.footer}</p>
        )}
      </div>

      {pending ? (
        <p className="mt-4 text-sm text-[var(--primary)]">
          มีคำขอชำระเงินรอตรวจสอบ (฿{pending.amount}) — ส่งเมื่อ{" "}
          {new Date(pending.createdAt).toLocaleDateString("th-TH")}
        </p>
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
          <Field label="ลิงก์หลักฐาน (URL สลิป)" hint="ถ้ามี">
            <TextInput
              value={proofUrl}
              onChange={(e) => setProofUrl(e.target.value)}
              placeholder="https://..."
            />
          </Field>
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
            <Button type="submit" disabled={busy}>
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
                ฿{p.amount} · {p.status}
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
