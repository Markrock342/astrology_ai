import Link from "next/link";
import type { CmsPaymentInfo } from "@/lib/cms-keys";
import { PaymentSubmitCard } from "./payment-submit-card";
import { ProfileAvatarCard } from "./profile-avatar-card";
import { UsageSummary } from "./usage-summary";
import { DeleteAccountCard } from "./delete-account-card";
import type { UsageLimitsFallback } from "@/types/my-usage";
import { PRO_EXPIRY_WARN_DAYS } from "@/config/constants";
import { AiMemoryCard } from "./ai-memory-card";
import { RenewHashScroller, RenewLink } from "./renew-link";
import type { UserAiMemory } from "@/server/user/ai-memory-service";

export type PublicPackage = {
  id: string;
  code: string;
  name: string;
  type: "FREE" | "PRO";
  price: number;
  billingLabel: string | null;
  creditQuota: number;
  usageBudgetUnits: number;
  description: string | null;
  features: string[];
  upgradeSteps: string[];
  /** True for CREDIT_TOPUP — shown in PaymentSubmitCard only, not plan grids. */
  creditOnly?: boolean;
};

type MyPackage = {
  plan: "FREE" | "PRO";
  creditBalance: number;
  usageRemainingPercent: number;
  usageUsedPercent: number;
  usagePeriodEndsAt: string | null;
  /** When Pro ends; null when it never does (admin-granted "ไม่มีวันหมดอายุ"). */
  proEndsAt?: string | null;
  proNeverExpires?: boolean;
  subscription: {
    status?: string;
    startsAt?: string;
    expiresAt?: string | null;
    package: {
      code: string;
      name: string;
      dailyLimit?: number | null;
      monthlyLimit?: number | null;
    };
  } | null;
};

function displayFeatures(pkg: PublicPackage): string[] {
  if (pkg.features.length > 0) {
    return pkg.features.map((feature) =>
      feature.startsWith("เครดิต")
        ? pkg.type === "PRO"
          ? "AI usage 100% ต่อรอบแพ็กเกจ"
          : "AI usage ทดลอง 100%"
        : feature,
    );
  }
  if (pkg.type === "PRO") {
    return [
      "AI usage 100% ต่อรอบแพ็กเกจ",
      "ปลดล็อกทุกหมวด + โหมดดวงจร",
      "คำถามแนะนำครบทุกหมวด",
    ];
  }
  return [
    "AI usage ทดลอง 100%",
    "หมวด「ตัวตน」กับ「การงาน」",
    "ถาม–ตอบกับ AI (ยืนยันอีเมลก่อน)",
  ];
}

function formatExpiry(iso: string): string {
  return new Date(iso).toLocaleDateString("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function daysUntil(iso: string): number {
  const ms = new Date(iso).getTime() - Date.now();
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

export function AccountView({
  profile,
  myPackage,
  packages,
  paymentInfo,
  aiMemory,
  hasIntake,
}: {
  profile: {
    name: string;
    email: string;
    image: string | null;
    canUploadAvatar: boolean;
  };
  myPackage: MyPackage;
  hasIntake: boolean;
  packages: PublicPackage[];
  paymentInfo: CmsPaymentInfo;
  aiMemory: UserAiMemory;
}) {
  const isPro = myPackage.plan === "PRO";
  // CREDIT_TOPUP is also type PRO — exclude credit-only from plan price/renew.
  const proPkg = packages.find(
    (p) =>
      p.type === "PRO" &&
      !p.creditOnly &&
      p.code !== "CREDIT_TOPUP" &&
      p.code !== "TOPUP",
  );
  const topUpPkg =
    packages.find((p) => p.code === "TOPUP" || p.code === "CREDIT_TOPUP") ??
    proPkg;
  const topUpPercent =
    topUpPkg && proPkg && proPkg.usageBudgetUnits > 0
      ? Math.round((topUpPkg.usageBudgetUnits / proPkg.usageBudgetUnits) * 100)
      : undefined;
  const showTopUpBanner =
    isPro && myPackage.usageRemainingPercent <= 20;

  // proEndsAt is the resolved answer (own subscription, else the promotion);
  // the raw subscription row is only a fallback for an older cached payload.
  const expiresAt =
    myPackage.proEndsAt ?? myPackage.subscription?.expiresAt ?? null;
  const neverExpires = isPro && Boolean(myPackage.proNeverExpires);
  const daysLeft = isPro && expiresAt ? daysUntil(expiresAt) : null;
  const expirySoon =
    daysLeft != null && daysLeft >= 0 && daysLeft <= PRO_EXPIRY_WARN_DAYS;

  const usageLimits: UsageLimitsFallback = {
    remainingPercent: myPackage.usageRemainingPercent,
    periodEndsAt: myPackage.usagePeriodEndsAt ?? expiresAt,
    dailyLimit: myPackage.subscription?.package.dailyLimit ?? null,
    monthlyLimit: myPackage.subscription?.package.monthlyLimit ?? null,
  };

  return (
    <div className="flex-1 px-6 py-10 md:px-10">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">
          บัญชี & แพ็กเกจ
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          จัดการแพ็กเกจและดูสิทธิ์การใช้งานของคุณ
        </p>

        <ProfileAvatarCard
          name={profile.name}
          email={profile.email}
          image={profile.image}
          canUpload={profile.canUploadAvatar}
        />

        <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <p className="text-xs text-[var(--muted-2)]">แพ็กเกจปัจจุบัน</p>
          <p className="mt-1 text-lg font-semibold text-[var(--primary)]">
            {myPackage.subscription?.package.name ?? (isPro ? "Pro" : "Free")}
          </p>
          {isPro && expiresAt ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p
                className={`text-sm ${
                  expirySoon ? "text-[var(--danger)]" : "text-[var(--muted)]"
                }`}
              >
                หมดอายุ {formatExpiry(expiresAt)}
                {daysLeft != null && daysLeft >= 0
                  ? ` · เหลือ ${daysLeft} วัน`
                  : ""}
              </p>
              <RenewLink className="press-scale rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs font-semibold text-[var(--primary-foreground)]">
                ต่ออายุ
              </RenewLink>
            </div>
          ) : null}
          {/* Admin-granted Pro with no end date — say so, instead of leaving the
              card silent about how long it lasts. */}
          {neverExpires ? (
            <p className="mt-3 text-sm text-[var(--muted)]">ไม่มีวันหมดอายุ</p>
          ) : null}
          {!isPro ? (
            <p className="mt-2 text-sm text-[var(--muted)]">
              {proPkg
                ? "ยังไม่ใช่ Pro หรือ Pro หมดอายุแล้ว — อัปเกรดหรือต่ออายุได้ด้านล่าง"
                : "แพ็กทดลอง Free"}
            </p>
          ) : null}
        </div>

        {expirySoon && expiresAt ? (
          <div className="mt-4 rounded-2xl border border-[var(--danger)]/35 bg-[var(--danger)]/10 px-4 py-3 text-sm text-[var(--foreground)]">
            Pro ใกล้หมดอายุ ({formatExpiry(expiresAt)}) —{" "}
            <RenewLink className="font-semibold text-[var(--primary)] underline">
              ต่ออายุที่นี่
            </RenewLink>
          </div>
        ) : null}

        <UsageSummary fallbackLimits={usageLimits} />

        {/* The survey used to block the way in and people bounced off it. It is
            offered here instead, for anyone who wants sharper readings. */}
        {hasIntake ? null : (
          <section className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
            <p className="text-xs font-medium text-[var(--primary)]">ไม่บังคับ</p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">
              เล่าชีวิตตอนนี้สั้น ๆ
            </h2>
            <p className="mt-1 max-w-xl text-sm leading-6 text-[var(--muted)]">
              ตอบ 10 ข้อ ใช้ประกอบคำทำนายให้ตรงกับชีวิตคุณมากขึ้น ข้ามได้ตลอด
              และไม่หัก usage
            </p>
            <Link
              href="/onboarding/survey"
              className="press-scale mt-4 inline-flex min-h-11 items-center rounded-full border border-[var(--primary)]/45 px-5 text-sm font-semibold text-[var(--primary)] transition hover:bg-[var(--primary)]/10"
            >
              เริ่มตอบ
            </Link>
          </section>
        )}

        <AiMemoryCard initialMemory={aiMemory} />

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {packages
            .filter(
              (pkg) =>
                !pkg.creditOnly &&
                pkg.code !== "CREDIT_TOPUP" &&
                pkg.code !== "TOPUP",
            )
            .map((pkg) => (
              <PlanCard
                key={pkg.id}
                name={pkg.name}
                price={String(pkg.price)}
                billingLabel={pkg.billingLabel ?? "ต่อแพ็กเกจ"}
                features={displayFeatures(pkg)}
                highlight={pkg.type === "PRO"}
                active={isPro ? pkg.type === "PRO" : pkg.type === "FREE"}
              />
            ))}
        </div>

        {!isPro && proPkg && (
          <div id="payment">
            <PaymentSubmitCard
              proPrice={proPkg.price}
              paymentInfo={paymentInfo}
            />
          </div>
        )}

        {isPro && proPkg ? (
          <div id="renew" className="scroll-mt-4">
            <RenewHashScroller />
            <PaymentSubmitCard
              variant="renew"
              proPrice={proPkg.price}
              paymentInfo={paymentInfo}
            />
          </div>
        ) : null}

        {isPro && topUpPkg && (
          <>
            {showTopUpBanner && (
              <div className="mt-6 rounded-2xl border border-[var(--primary)]/35 bg-[var(--primary)]/10 px-4 py-3 text-sm text-[var(--muted)]">
                usage เหลือ{" "}
                <span className="font-semibold text-[var(--foreground)]">
                  {myPackage.usageRemainingPercent}%
                </span>{" "}
                — เติม usage เพื่อถามต่อได้ไม่สะดุด
              </div>
            )}
            <div id="topup">
              <PaymentSubmitCard
                variant="topup"
                proPrice={topUpPkg.price}
                usagePercent={topUpPercent}
                currentUsagePercent={myPackage.usageRemainingPercent}
                paymentInfo={paymentInfo}
              />
            </div>
            {/* Legacy hash used by older banners */}
            <div id="payment" className="sr-only" aria-hidden />
          </>
        )}

        <DeleteAccountCard email={profile.email} />
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
