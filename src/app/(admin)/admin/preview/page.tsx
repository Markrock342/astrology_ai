import Link from "next/link";
import { redirect } from "next/navigation";
import { CmsDocumentView } from "@/components/cms/cms-document-view";
import {
  CMS_DEFAULTS,
  CMS_KEYS,
  type CmsDocument,
  type CmsKey,
  type CmsSeo,
  type CmsText,
} from "@/lib/cms-keys";
import { requireAdmin } from "@/server/auth/rbac";
import { getDraftSetting, getPublishedSetting } from "@/server/settings/settings-service";

export const dynamic = "force-dynamic";

export default async function AdminPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string; mode?: string }>;
}) {
  await requireAdmin();
  const { key, mode } = await searchParams;
  if (!key || !(key in CMS_DEFAULTS)) redirect("/admin/settings");

  const cmsKey = key as CmsKey;
  const value =
    mode === "published"
      ? await getPublishedSetting(cmsKey)
      : await getDraftSetting(cmsKey);

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <div className="mb-6 flex flex-wrap items-center gap-3 text-xs text-[var(--muted)]">
        <BadgeLabel>{mode === "published" ? "เผยแพร่แล้ว" : "แบบร่าง / preview"}</BadgeLabel>
        <Link href="/admin/settings" className="text-[var(--primary)] hover:underline">
          ← กลับแก้ไข
        </Link>
      </div>

      {renderPreview(cmsKey, value)}
    </main>
  );
}

function BadgeLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-[var(--primary)]/30 bg-[var(--primary)]/10 px-2.5 py-0.5 text-[var(--primary)]">
      {children}
    </span>
  );
}

function renderPreview(key: CmsKey, value: unknown) {
  if (key === CMS_KEYS.privacyPolicy || key === CMS_KEYS.termsOfService) {
    return <CmsDocumentView doc={value as CmsDocument} />;
  }
  if (
    key === CMS_KEYS.disclaimer ||
    key === CMS_KEYS.consentRegister ||
    key === CMS_KEYS.consentBirthPrivacy ||
    key === CMS_KEYS.consentBirthEditLimit
  ) {
    return (
      <p className="rounded-lg border border-[var(--border)] p-4 text-sm">
        {(value as CmsText).text}
      </p>
    );
  }
  if (
    key === CMS_KEYS.seoHome ||
    key === CMS_KEYS.seoPrivacy ||
    key === CMS_KEYS.seoTerms ||
    key === CMS_KEYS.seoDisclaimer ||
    key === CMS_KEYS.seoFaq
  ) {
    const seo = value as CmsSeo;
    return (
      <div className="space-y-3 text-sm">
        <p>
          <strong>Title:</strong> {seo.title}
        </p>
        <p>
          <strong>Description:</strong> {seo.description}
        </p>
        {seo.ogTitle && (
          <p>
            <strong>OG title:</strong> {seo.ogTitle}
          </p>
        )}
        {seo.ogImageUrl && (
          <p>
            <strong>OG image:</strong> {seo.ogImageUrl}
          </p>
        )}
      </div>
    );
  }
  return (
    <pre className="overflow-auto rounded-lg border border-[var(--border)] p-4 text-xs">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}
