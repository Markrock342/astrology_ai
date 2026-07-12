import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { CmsDocumentView } from "@/components/cms/cms-document-view";
import { CMS_KEYS, type CmsSeo } from "@/lib/cms-keys";
import { metadataFromSeo } from "@/lib/seo";
import { getDisclaimerDocument, getPublishedSetting } from "@/server/settings/settings-service";

export const revalidate = 60;

export async function generateMetadata() {
  const seo = (await getPublishedSetting(CMS_KEYS.seoDisclaimer)) as CmsSeo;
  return metadataFromSeo(seo);
}

export default async function DisclaimerPage() {
  const doc = await getDisclaimerDocument();

  return (
    <main className="mx-auto max-w-2xl flex-1 px-6 py-16">
      <Link href="/login" className="mb-8 inline-block">
        <BrandLogo size={36} />
      </Link>
      <CmsDocumentView doc={doc} />
    </main>
  );
}
