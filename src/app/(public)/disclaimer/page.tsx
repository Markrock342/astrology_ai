import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { CmsTextView } from "@/components/cms/cms-text-view";
import { CMS_KEYS, CMS_LABELS, type CmsSeo } from "@/lib/cms-keys";
import { metadataFromSeo } from "@/lib/seo";
import { getDisclaimerText, getPublishedSetting } from "@/server/settings/settings-service";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const seo = (await getPublishedSetting(CMS_KEYS.seoDisclaimer)) as CmsSeo;
  return metadataFromSeo(seo);
}

export default async function DisclaimerPage() {
  const text = await getDisclaimerText();

  return (
    <main className="mx-auto max-w-2xl flex-1 px-6 py-16">
      <Link href="/login" className="mb-8 inline-block">
        <BrandLogo size={36} />
      </Link>
      <CmsTextView title={CMS_LABELS[CMS_KEYS.disclaimer]} text={text} />
    </main>
  );
}
