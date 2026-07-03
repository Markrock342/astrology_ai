import Link from "next/link";

export type PublicPackage = {
  id: string;
  code: string;
  name: string;
  type: "FREE" | "PRO";
  price: number;
  billingLabel: string | null;
  creditQuota: number;
  description: string | null;
  features: string[];
  upgradeSteps: string[];
};

type MyPackage = {
  plan: "FREE" | "PRO";
  creditBalance: number;
  subscription: {
    package: { code: string; name: string };
  } | null;
};

function displayFeatures(pkg: PublicPackage): string[] {
  if (pkg.features.length > 0) return pkg.features;
  if (pkg.type === "PRO") {
    return [
      `เครดิต ${pkg.creditQuota} ครั้ง`,
      "ปลดล็อกทุกหมวด + โหมดดวงจร",
      "คำถามแนะนำครบทุกหมวด",
    ];
  }
  return [
    `เครดิต ${pkg.creditQuota} ครั้ง`,
    "หมวดพื้นดวงเดิม (บางหมวด)",
    "ถาม–ตอบกับ AI",
  ];
}

const DEFAULT_UPGRADE_STEPS = [
  "โอนเงินตามยอดแพ็กเกจ Pro",
  "แจ้งหลักฐานการโอนให้แอดมิน",
  "แอดมินตรวจสอบและเปิดสิทธิ์ Pro ให้บัญชีของคุณ",
];

export function AccountView({
  myPackage,
  packages,
  upgradeSteps,
}: {
  myPackage: MyPackage;
  packages: PublicPackage[];
  upgradeSteps: string[];
}) {
  const isPro = myPackage.plan === "PRO";
  const proPkg = packages.find((p) => p.type === "PRO");
  const steps = upgradeSteps.length > 0 ? upgradeSteps : DEFAULT_UPGRADE_STEPS;

  return (
    <div className="flex-1 overflow-y-auto px-6 py-10 md:px-10">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">
          บัญชี & แพ็กเกจ
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          จัดการแพ็กเกจและดูสิทธิ์การใช้งานของคุณ
        </p>

        <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[var(--muted-2)]">แพ็กเกจปัจจุบัน</p>
              <p className="mt-1 text-lg font-semibold text-[var(--primary)]">
                {myPackage.subscription?.package.name ?? (isPro ? "Pro" : "Free")}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-[var(--muted-2)]">เครดิตคงเหลือ</p>
              <p className="mt-1 text-lg font-semibold text-[var(--foreground)]">
                {myPackage.creditBalance}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {packages.map((pkg) => (
            <PlanCard
              key={pkg.id}
              name={pkg.name}
              price={String(pkg.price)}
              billingLabel={pkg.billingLabel ?? "ต่อแพ็กเกจ"}
              features={displayFeatures(pkg)}
              highlight={pkg.type === "PRO"}
              active={
                isPro ? pkg.type === "PRO" : pkg.type === "FREE"
              }
            />
          ))}
        </div>

        {!isPro && proPkg && (
          <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="text-sm font-semibold text-[var(--foreground)]">
              วิธีอัปเกรดเป็น Pro (ชำระเงินแบบ manual)
            </h2>
            <ol className="mt-3 list-inside list-decimal space-y-1.5 text-sm text-[var(--muted)]">
              {steps.map((step, i) => (
                <li key={i}>
                  {step.replace("199", String(proPkg.price))}
                </li>
              ))}
            </ol>
            <Link
              href="/account#payment"
              className="press-scale mt-4 inline-block rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] transition hover:bg-[var(--primary-hover)]"
            >
              แจ้งชำระเงิน
            </Link>
            <p className="mt-3 text-xs text-[var(--muted-2)]" id="payment">
              ฟีเจอร์แจ้งชำระเงินออนไลน์จะเปิดในเฟสถัดไป — ติดต่อแอดมินเพื่ออัปเกรด Pro
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function PlanCard({
  name,
  price,
  billingLabel,
  features,
  highlight,
  active,
}: {
  name: string;
  price: string;
  billingLabel: string;
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
        <span className="text-xs text-[var(--muted-2)]"> / {billingLabel}</span>
      </p>
      <ul className="mt-4 space-y-2 text-sm text-[var(--muted)]">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              className="mt-0.5 shrink-0 text-[var(--secondary-active)]"
            >
              <path
                d="M5 12l5 5 9-11"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {f}
          </li>
        ))}
      </ul>
    </div>
  );
}
