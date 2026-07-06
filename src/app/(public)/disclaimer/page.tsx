import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { CmsTextView } from "@/components/cms/cms-text-view";
import { CMS_LABELS, CMS_KEYS } from "@/lib/cms-keys";
import { getDisclaimerText } from "@/server/settings/settings-service";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return { title: `${CMS_LABELS[CMS_KEYS.disclaimer]} — โหราศาสตร์` };
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
