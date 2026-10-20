import type { Metadata } from "next";
import { PublicPageHeader } from "@/components/marketing/public-page-header";
import { ContactForm } from "@/components/marketing/contact-form";
import {
  CMS_KEYS,
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

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const seo =
    (await getSeoForPath("/contact")) ??
    ((await getPublishedSetting(CMS_KEYS.seoContact)) as CmsSeo);
  return metadataFromSeo(seo, { path: "/contact" });
}

export default async function ContactPage() {
  const preview = await isPreviewMode();
  const cms = <K extends typeof CMS_KEYS[keyof typeof CMS_KEYS]>(key: K) =>
    preview ? getDraftSetting(key) : getPublishedSetting(key);

  const footer = (await cms(CMS_KEYS.siteFooter)) as CmsSiteFooter;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-6 py-16">
      <PublicPageHeader className="mb-10" />

      <h1 className="text-center text-3xl font-semibold text-[var(--foreground)]">
        ติดต่อเรา
      </h1>
      <p className="mt-3 text-center text-sm leading-relaxed text-[var(--muted)]">
        สอบถามเรื่องบัญชี การชำระเงิน หรือข้อเสนอแนะ — ทีมงานพร้อมช่วยเหลือ
      </p>

      <ContactForm />

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
