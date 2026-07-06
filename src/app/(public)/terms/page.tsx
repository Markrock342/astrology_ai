import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { CmsDocumentView } from "@/components/cms/cms-document-view";
import { getTermsDocument } from "@/server/settings/settings-service";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const doc = await getTermsDocument();
  return { title: `${doc.title} — โหราศาสตร์` };
}

export default async function TermsPage() {
  const doc = await getTermsDocument();

  return (
    <main className="mx-auto max-w-2xl flex-1 px-6 py-16">
      <Link href="/login" className="mb-8 inline-block">
        <BrandLogo size={36} />
      </Link>
      <CmsDocumentView doc={doc} />
    </main>
  );
}
