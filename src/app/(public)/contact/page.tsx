import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark } from "@/components/brand-logo";
import {
  CMS_KEYS,
  type CmsContact,
  type CmsSeo,
  type CmsSiteFooter,
} from "@/lib/cms-keys";
import { metadataFromSeo } from "@/lib/seo";
import { isPreviewMode } from "@/server/cms/preview-mode";
import {
  getDraftSetting,
  getPublishedSetting,
  getSeoForPath,
} from "@/server/settings/settings-service";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const seo =
    (await getSeoForPath("/contact")) ??
    ((await getPublishedSetting(CMS_KEYS.seoContact)) as CmsSeo);
  return metadataFromSeo(seo);
}

export default async function ContactPage() {
  const preview = await isPreviewMode();
  const cms = <K extends typeof CMS_KEYS[keyof typeof CMS_KEYS]>(key: K) =>
    preview ? getDraftSetting(key) : getPublishedSetting(key);

  const [contact, footer] = await Promise.all([
    cms(CMS_KEYS.contact) as Promise<CmsContact>,
    cms(CMS_KEYS.siteFooter) as Promise<CmsSiteFooter>,
  ]);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-6 py-16">
      <Link href="/" className="mb-10 inline-flex flex-col items-center gap-3 self-center">
        <BrandMark size={48} />
        <span className="text-sm text-[var(--muted)]">โหราศาสตร์</span>
      </Link>

      <h1 className="text-center text-3xl font-semibold text-[var(--foreground)]">
        ติดต่อเรา
      </h1>
      <p className="mt-3 text-center text-sm leading-relaxed text-[var(--muted)]">
        สอบถามเรื่องบัญชี การชำระเงิน หรือข้อเสนอแนะ — ทีมงานพร้อมช่วยเหลือ
      </p>

      <div className="mt-10 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center sm:p-8">
        {contact.label ? (
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted-2)]">
            {contact.label}
          </p>
        ) : null}
        <a
          href={`mailto:${contact.email}`}
          className="mt-3 inline-block text-lg font-semibold text-[var(--primary)] underline-offset-2 hover:underline"
        >
          {contact.email}
        </a>
      </div>

      {footer.socialLinks.length > 0 ? (
        <div className="mt-10 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-2)]">
            ช่องทางอื่น
          </p>
          <ul className="mt-4 flex flex-wrap justify-center gap-4">
            {footer.socialLinks.map((link) => (
              <li key={`${link.href}-${link.label}`}>
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[var(--muted)] transition hover:text-[var(--primary)]"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </main>
  );
}
