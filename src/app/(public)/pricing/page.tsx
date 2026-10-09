import type { Metadata } from "next";
import Link from "next/link";
import { BrandLockup } from "@/components/brand-logo";
import { SimpleMarkdown } from "@/components/cms/simple-markdown";
import { PricingSection, type PricingViewer } from "@/components/marketing/pricing-section";
import { auth } from "@/auth";
import { getEffectivePlan } from "@/server/user/account-service";
import {
  CMS_KEYS,
  type CmsLandingPricingSection,
  type CmsPaymentInfo,
  type CmsSeo,
} from "@/lib/cms-keys";
import { isPaymentInfoConfigured, paymentUnavailableNote } from "@/lib/payment-info";
import { metadataFromSeo } from "@/lib/seo";
import { DEFAULT_PACK_STEPS } from "@/lib/pack-expiry";
import { listPublicPackages } from "@/server/admin/catalog-admin-service";
import { isPreviewMode } from "@/server/cms/preview-mode";
import {
  getDraftSetting,
  getPublishedSetting,
  getSeoForPath,
} from "@/server/settings/settings-service";

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const seo =
    (await getSeoForPath("/pricing")) ??
    ((await getPublishedSetting(CMS_KEYS.seoPricing)) as CmsSeo);
  return metadataFromSeo(seo, { path: "/pricing" });
}

/** Visitor, Free or Pro — the buttons on this page depend on it. */
async function viewerOf(): Promise<PricingViewer> {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return "guest";
    return await getEffectivePlan(userId);
  } catch {
    return "guest";
  }
}

export default async function PricingPage() {
  const preview = await isPreviewMode();
  const cms = <K extends typeof CMS_KEYS[keyof typeof CMS_KEYS]>(key: K) =>
    preview ? getDraftSetting(key) : getPublishedSetting(key);

  const [section, paymentInfo, packages, viewer] = await Promise.all([
    cms(CMS_KEYS.landingPricingSection) as Promise<CmsLandingPricingSection>,
    cms(CMS_KEYS.paymentInfo) as Promise<CmsPaymentInfo>,
    listPublicPackages().catch(() => []),
    viewerOf(),
  ]);

  const pricingSection: CmsLandingPricingSection = {
    ...section,
    enabled: true,
  };
  const paymentConfigured = isPaymentInfoConfigured(paymentInfo);
  const proPkg = packages.find(
    (p) => p.type === "PRO" && !p.creditOnly && p.code !== "CREDIT_TOPUP" && p.code !== "TOPUP",
  );
  // The team writes the transfer details in the Pro package's "ขั้นตอนอัปเกรด"
  // field; the page only read the site-wide payment settings, which were
  // empty, so it said payments were not open.
  // Question packs (Oct 2026): any pack is bought the same way, so the steps
  // come from the first one and the price is the one picked above.
  const packs = packages.filter((p) => p.questionPack);
  const ownSteps = ((packs[0] ?? proPkg)?.upgradeSteps ?? []).filter((s) => s.trim());
  const upgradeSteps = packs.length > 0 && ownSteps.length === 0 ? DEFAULT_PACK_STEPS : ownSteps;
  const hasPaymentDetails = paymentConfigured || upgradeSteps.length > 0;

  return (
    <main className="flex flex-1 flex-col">
      <header className="border-b border-[var(--border)] bg-[var(--background)]/80 px-4 backdrop-blur sm:px-6">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3">
          <Link href="/" aria-label="กลับหน้าแรก" className="min-w-0">
            <BrandLockup markSize={30} />
          </Link>
          <Link
            href={viewer === "guest" ? "/login" : "/dashboard"}
            className="shrink-0 rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground)] transition hover:border-[var(--primary)]/50 hover:bg-[var(--surface-2)]"
          >
            {viewer === "guest" ? "เข้าสู่ระบบ" : "ไปหน้าแชท"}
          </Link>
        </div>
      </header>

      <PricingSection
        section={pricingSection}
        packages={packages}
        viewer={viewer}
        paymentHref="#payment"
        bordered={false}
      />

      <section id="payment" className="scroll-mt-6 border-t border-[var(--border)] px-6 py-16">
        <div className="mx-auto max-w-2xl rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            {/* The CMS title still says "อัปเกรด Pro" from the monthly plan. */}
            {packs.length > 0 ? "วิธีซื้อแพ็กคำถาม" : paymentInfo.title}
          </h2>
          {packs.length > 0 ? (
            <p className="mt-3 text-sm text-[var(--muted)]">
              โอนตามราคาแพ็กที่เลือกด้านบน แล้วส่งสลิปในหน้าบัญชี — คำถามบวกเพิ่มจากที่เหลือ
            </p>
          ) : proPkg ? (
            <p className="mt-3 flex flex-wrap items-baseline gap-x-2">
              <span className="text-sm text-[var(--muted)]">{proPkg.name}</span>
              <span className="text-2xl font-semibold text-[var(--primary)]">
                ฿{proPkg.price.toLocaleString("th-TH")}
              </span>
              <span className="text-xs text-[var(--muted-2)]">/ {proPkg.billingLabel ?? "ต่อแพ็กเกจ"}</span>
            </p>
          ) : null}
          {paymentConfigured ? (
            <>
              <dl className="mt-4 space-y-2 text-sm text-[var(--muted)]">
                <div className="flex flex-wrap gap-x-2">
                  <dt className="text-[var(--muted-2)]">ธนาคาร</dt>
                  <dd>{paymentInfo.bankName}</dd>
                </div>
                <div className="flex flex-wrap gap-x-2">
                  <dt className="text-[var(--muted-2)]">ชื่อบัญชี</dt>
                  <dd>{paymentInfo.accountName}</dd>
                </div>
                <div className="flex flex-wrap gap-x-2">
                  <dt className="text-[var(--muted-2)]">เลขบัญชี</dt>
                  <dd className="font-medium text-[var(--foreground)]">
                    {paymentInfo.accountNumber}
                  </dd>
                </div>
              </dl>
              {paymentInfo.amountNote ? (
                <p className="mt-4 text-sm text-[var(--muted)]">
                  {paymentInfo.amountNote}
                </p>
              ) : null}
              {paymentInfo.steps.length > 0 ? (
                <ol className="mt-5 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-[var(--muted)]">
                  {paymentInfo.steps.map((step, i) => (
                    <li key={i}>
                      <SimpleMarkdown text={step} />
                    </li>
                  ))}
                </ol>
              ) : null}
            </>
          ) : null}
          {upgradeSteps.length > 0 ? (
            <div className="mt-5">
              <p className="text-sm font-medium text-[var(--foreground)]">{packs.length > 0 ? "ขั้นตอนการซื้อ" : "ขั้นตอนอัปเกรด"}</p>
              <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-[var(--muted)]">
                {upgradeSteps.map((step, i) => (
                  <li key={i}>
                    <SimpleMarkdown text={step} />
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
          {paymentConfigured && paymentInfo.footer ? (
            <p className="mt-5 text-xs text-[var(--muted-2)]">{paymentInfo.footer}</p>
          ) : null}
          {!hasPaymentDetails ? (
            <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
              {paymentUnavailableNote(paymentInfo)}
            </p>
          ) : null}
        </div>

        <div className="mx-auto mt-10 flex max-w-md flex-wrap justify-center gap-3">
          {viewer === "guest" ? (
            <>
              <Link
                href="/login?tab=register"
                className="rounded-full bg-[var(--primary)] px-6 py-3 text-sm font-semibold text-[var(--primary-foreground)] transition hover:bg-[var(--primary-hover)]"
              >
                สมัครสมาชิก
              </Link>
              <Link
                href="/login"
                className="rounded-full border border-[var(--border)] px-6 py-3 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--surface-2)]"
              >
                เข้าสู่ระบบ
              </Link>
            </>
          ) : viewer === "FREE" ? (
            <Link
              href="/account#payment"
              className="rounded-full bg-[var(--primary)] px-6 py-3 text-sm font-semibold text-[var(--primary-foreground)] transition hover:bg-[var(--primary-hover)]"
            >
              {packs.length > 0 ? "โอนแล้ว — ส่งสลิป" : "โอนแล้ว — ส่งสลิปอัปเกรด Pro"}
            </Link>
          ) : packs.length > 0 ? (
            <Link
              href="/account#payment"
              className="rounded-full bg-[var(--primary)] px-6 py-3 text-sm font-semibold text-[var(--primary-foreground)] transition hover:bg-[var(--primary-hover)]"
            >
              ซื้อแพ็กคำถามเพิ่ม
            </Link>
          ) : (
            <Link
              href="/account#renew"
              className="rounded-full border border-[var(--border)] px-6 py-3 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--surface-2)]"
            >
              ต่ออายุ Pro
            </Link>
          )}
        </div>
      </section>
    </main>
  );
}
