import { PreviewBanner } from "@/components/cms/preview-banner";
import { PublicAnnouncementBanner } from "@/components/marketing/public-announcement-banner";
import { SiteFooter } from "@/components/marketing/site-footer";
import { CMS_KEYS, type CmsSiteFooter } from "@/lib/cms-keys";
import { isPreviewMode } from "@/server/cms/preview-mode";
import {
  getActiveAnnouncements,
  getDraftSetting,
  getPublishedSetting,
} from "@/server/settings/settings-service";

export const revalidate = 60;

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const preview = await isPreviewMode();
  const [footer, announcements] = await Promise.all([
    (preview
      ? getDraftSetting(CMS_KEYS.siteFooter)
      : getPublishedSetting(CMS_KEYS.siteFooter)) as Promise<CmsSiteFooter>,
    getActiveAnnouncements().catch(() => []),
  ]);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      {preview ? <PreviewBanner /> : null}
      <PublicAnnouncementBanner announcements={announcements} />
      <div className="flex flex-1 flex-col">{children}</div>
      <SiteFooter footer={footer} />
    </div>
  );
}
