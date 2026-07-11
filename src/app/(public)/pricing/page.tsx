import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark } from "@/components/brand-logo";
import { SimpleMarkdown } from "@/components/cms/simple-markdown";
import { PricingSection } from "@/components/marketing/pricing-section";
import {
  CMS_KEYS,
  type CmsLandingPricingSection,
  type CmsPaymentInfo,
  type CmsSeo,
} from "@/lib/cms-keys";
import { metadataFromSeo } from "@/lib/seo";
import { listPublicPackages } from "@/server/admin/catalog-admin-service";
import { isPreviewMode } from "@/server/cms/preview-mode";
import {
  getDraftSetting,
  getPublishedSetting,
  getSeoForPath,
} from "@/server/settings/settings-service";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const seo =
    (await getSeoForPath("/pricing")) ??
    ((await getPublishedSetting(CMS_KEYS.seoPricing)) as CmsSeo);
  return metadataFromSeo(seo);
}

export default async function PricingPage() {
  const preview = await isPreviewMode();
  const cms = <K extends typeof CMS_KEYS[keyof typeof CMS_KEYS]>(key: K) =>
    preview ? getDraftSetting(key) : getPublishedSetting(key);

  const [section, paymentInfo, packages] = await Promise.all([
    cms(CMS_KEYS.landingPricingSection) as Promise<CmsLandingPricingSection>,
    cms(CMS_KEYS.paymentInfo) as Promise<CmsPaymentInfo>,
    listPublicPackages(),
  ]);

  const pricingSection: CmsLandingPricingSection = {
    ...section,
    enabled: true,
  };

  return (
    <main className="flex flex-1 flex-col">
      <div className="mx-auto w-full max-w-5xl px-6 pt-14 text-center">
        <Link href="/" className="inline-flex flex-col items-center gap-3">
          <BrandMark size={48} />
          <span className="text-sm text-[var(--muted)]">โหราศาสตร์</span>
        </Link>
      </div>

      <PricingSection section={pricingSection} packages={packages} />

      <section className="border-t border-[var(--border)] px-6 py-16">
        <div className="mx-auto max-w-2xl rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            {paymentInfo.title}
          </h2>
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
            <p className="mt-4 text-sm text-[var(--muted)]">{paymentInfo.amountNote}</p>
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
          {paymentInfo.footer ? (
            <p className="mt-5 text-xs text-[var(--muted-2)]">{paymentInfo.footer}</p>
          ) : null}
        </div>

        <div className="mx-auto mt-10 flex max-w-md flex-wrap justify-center gap-3">
          <Link
            href="/login?tab=register"
            className="rounded-full bg-[var(--primary)] px-6 py-3 text-sm font-semibold text-[var(--primary-foreground)] transition hover:bg-[var(--primary-hover)]"
          >
            สมัครแล้วอัปเกรด
          </Link>
          <Link
            href="/login"
            className="rounded-full border border-[var(--border)] px-6 py-3 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--surface-2)]"
          >
            เข้าสู่ระบบ
          </Link>
        </div>
      </section>
    </main>
  );
}
