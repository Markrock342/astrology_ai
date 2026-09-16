import { PublicPageHeader } from "@/components/marketing/public-page-header";
import { CmsDocumentView } from "@/components/cms/cms-document-view";
import { CMS_KEYS, type CmsSeo } from "@/lib/cms-keys";
import { metadataFromSeo } from "@/lib/seo";
import { getPrivacyDocument, getPublishedSetting } from "@/server/settings/settings-service";

export const revalidate = 60;

export async function generateMetadata() {
  const seo = (await getPublishedSetting(CMS_KEYS.seoPrivacy)) as CmsSeo;
  return metadataFromSeo(seo);
}

export default async function PrivacyPage() {
  const doc = await getPrivacyDocument();

  return (
    <main className="mx-auto max-w-2xl flex-1 px-6 py-16">
      <PublicPageHeader className="mb-8" />
      <CmsDocumentView doc={doc} />
    </main>
  );
}
