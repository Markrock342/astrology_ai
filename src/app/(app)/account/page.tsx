import { DEFAULTS } from "@/config/constants";
import { MOCK_USER } from "@/components/app/nav-data";

/**
 * Account & package page (reached from settings → "จัดการแพ็กเกจ").
 * Phase 1 upgrade is manual, so this shows plan comparison + manual-payment
 * instructions rather than a checkout.
 *
 * TODO(backend): read current plan/credits from GET /api/me + /api/me/credits;
 * submit manual payment via POST /api/payments/manual.
 */
export default function AccountPage() {
  const isPro = MOCK_USER.tier === "PRO";

  return (
    <div className="flex-1 overflow-y-auto px-6 py-10 md:px-10">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">
          บัญชี & แพ็กเกจ
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          จัดการแพ็กเกจและดูสิทธิ์การใช้งานของคุณ
        </p>

        {/* Current status */}
        <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[var(--muted-2)]">แพ็กเกจปัจจุบัน</p>
              <p className="mt-1 text-lg font-semibold text-[var(--primary)]">
                {isPro ? "Pro" : "Free"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-[var(--muted-2)]">เครดิตคงเหลือ</p>
              <p className="mt-1 text-lg font-semibold text-[var(--foreground)]">
                {isPro ? DEFAULTS.proCreditQuota : DEFAULTS.freeCreditQuota}
              </p>
            </div>
          </div>
        </div>

        {/* Plan comparison */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <PlanCard
            name="Free"
            price="0"
            active={!isPro}
            features={[
              `เครดิต ${DEFAULTS.freeCreditQuota} ครั้ง`,
              "หมวดพื้นดวงเดิม (บางหมวด)",
              "ถาม–ตอบกับ AI",
            ]}
          />
          <PlanCard
            name="Pro"
            price={String(DEFAULTS.proPriceThb)}
            highlight
            active={isPro}
            features={[
              `เครดิต ${DEFAULTS.proCreditQuota} ครั้ง`,
              "ปลดล็อกทุกหมวด + โหมดดวงจร",
              "คำถามแนะนำครบทุกหมวด",
            ]}
          />
        </div>

        {/* Manual upgrade */}
        {!isPro && (
          <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="text-sm font-semibold text-[var(--foreground)]">
              วิธีอัปเกรดเป็น Pro (ชำระเงินแบบ manual)
            </h2>
            <ol className="mt-3 list-inside list-decimal space-y-1.5 text-sm text-[var(--muted)]">
              <li>โอนเงินตามยอดแพ็กเกจ Pro ({DEFAULTS.proPriceThb} บาท)</li>
              <li>แจ้งหลักฐานการโอนให้แอดมิน</li>
              <li>แอดมินตรวจสอบและเปิดสิทธิ์ Pro ให้บัญชีของคุณ</li>
            </ol>
            <button
              type="button"
              className="mt-4 rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] transition hover:bg-[var(--primary-hover)]"
            >
              แจ้งชำระเงิน
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function PlanCard({
  name,
  price,
  features,
  highlight,
  active,
}: {
  name: string;
  price: string;
  features: string[];
  highlight?: boolean;
  active?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-6 ${
        highlight
          ? "border-[var(--primary)]/50 bg-[var(--surface)]"
          : "border-[var(--border)] bg-[var(--surface)]"
      }`}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[var(--foreground)]">{name}</h3>
        {active && (
          <span className="rounded-full bg-[var(--secondary-active)]/15 px-2.5 py-0.5 text-[11px] text-[var(--secondary-active)]">
            ใช้งานอยู่
          </span>
        )}
      </div>
      <p className="mt-2">
        <span className="text-2xl font-semibold text-[var(--primary)]">฿{price}</span>
        <span className="text-xs text-[var(--muted-2)]"> / แพ็กเกจ</span>
      </p>
      <ul className="mt-4 space-y-2 text-sm text-[var(--muted)]">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="mt-0.5 shrink-0 text-[var(--secondary-active)]">
              <path d="M5 12l5 5 9-11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {f}
          </li>
        ))}
      </ul>
    </div>
  );
}
