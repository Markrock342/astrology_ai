"use client";

import { useEffect, useState } from "react";
import type { CmsPaymentInfo } from "@/lib/cms-keys";
import { PaymentSubmitCard } from "./payment-submit-card";
import { DEFAULT_PACK_STEPS } from "@/lib/pack-expiry";

export type PurchasablePack = {
  code: string;
  name: string;
  price: number;
  questions: number;
  expiryLabel: string | null;
  upgradeSteps: string[];
};

const per = (p: PurchasablePack) =>
  p.questions > 0 ? (p.price / p.questions).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—";

/**
 * Pick a question pack, transfer, send the slip — one card. The pricing page
 * links here with ?pack=CODE so the pack the reader chose is already picked.
 */
export function PackPurchase({ packs, paymentInfo }: { packs: PurchasablePack[]; paymentInfo: CmsPaymentInfo }) {
  const cheapestPer = packs.reduce<PurchasablePack | null>(
    (best, p) => (p.questions > 0 && (!best || p.price / p.questions < best.price / best.questions) ? p : best),
    null,
  );
  const [code, setCode] = useState(cheapestPer?.code ?? packs[0]?.code ?? "");

  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("pack");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (wanted && packs.some((p) => p.code === wanted)) setCode(wanted);
  }, [packs]);

  const picked = packs.find((p) => p.code === code) ?? packs[0];
  if (!picked) return null;

  return (
    <section className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
      <h2 className="text-lg font-semibold text-[var(--foreground)]">ซื้อแพ็กคำถาม</h2>
      <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
        จ่ายครั้งเดียว คำถามบวกเพิ่มจากที่เหลือ · เปิดทุกหมวด ดวงจร และดวงสมพงษ์ · ถาม 1 ครั้ง = 1 คำถาม
      </p>
      <div role="radiogroup" aria-label="เลือกแพ็ก" className="mt-4 grid gap-2 sm:grid-cols-3">
        {packs.map((p) => {
          const active = p.code === picked.code;
          return (
            <button
              key={p.code}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setCode(p.code)}
              className={`press-scale min-h-11 rounded-xl border p-3 text-left transition ${
                active
                  ? "border-[var(--primary)] bg-[var(--primary)]/10"
                  : "border-[var(--border)] hover:border-[var(--primary)]/40"
              }`}
            >
              <span className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold text-[var(--foreground)]">
                  {p.questions.toLocaleString("th-TH")} คำถาม
                </span>
                <span className="text-base font-semibold tabular-nums text-[var(--primary)]">฿{p.price.toLocaleString("th-TH")}</span>
              </span>
              <span className="mt-1 block text-[11px] text-[var(--muted-2)]">
                คำถามละ ฿{per(p)}
                {p.code === cheapestPer?.code && packs.length > 1 ? " · คุ้มที่สุด" : ""}
              </span>
              <span className="block text-[11px] text-[var(--muted-2)]">{p.expiryLabel ?? "ไม่มีวันหมดอายุ"}</span>
            </button>
          );
        })}
      </div>
      <ol className="mt-4 list-decimal space-y-1.5 pl-5 text-sm leading-6 text-[var(--muted)]">
        {(picked.upgradeSteps.length ? picked.upgradeSteps : DEFAULT_PACK_STEPS).map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <PaymentSubmitCard
        key={picked.code}
        variant="pack"
        packageCode={picked.code}
        packName={picked.name}
        proPrice={picked.price}
        paymentInfo={paymentInfo}
      />
    </section>
  );
}
