import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { FaqView } from "@/components/cms/faq-view";
import { CMS_KEYS, type CmsSeo } from "@/lib/cms-keys";
import { metadataFromSeo } from "@/lib/seo";
import { isPreviewMode } from "@/server/cms/preview-mode";
import {
  getFaqForPublic,
  getPublishedSetting,
  getSeoForPath,
} from "@/server/settings/settings-service";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const seo =
    (await getSeoForPath("/help")) ??
    ((await getPublishedSetting(CMS_KEYS.seoFaq)) as CmsSeo);
  return metadataFromSeo(seo);
}

export default async function HelpPage() {
  const preview = await isPreviewMode();
  const items = await getFaqForPublic(preview);

  return (
    <main className="mx-auto max-w-2xl flex-1 px-6 py-16">
      <Link href="/" className="mb-8 inline-block">
        <BrandLogo size={36} />
      </Link>
      <h1 className="text-2xl font-semibold text-[var(--foreground)]">คำถามที่พบบ่อย</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        คำตอบเกี่ยวกับเครดิต แพ็กเกจ Pro การชำระเงิน และการใช้งาน
      </p>
      <div className="mt-8">
        {items.length > 0 ? (
          <FaqView items={items} />
        ) : (
          <p className="text-sm text-[var(--muted-2)]">กำลังจัดทำเนื้อหา — กลับมาใหม่เร็ว ๆ นี้</p>
        )}
      </div>
    </main>
  );
}
