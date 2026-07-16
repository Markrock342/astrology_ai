import { SiteThemeManager } from "@/components/admin/site-theme-manager";
import { CMS_KEYS, type CmsSiteTheme } from "@/lib/cms-keys";
import { requireAdmin } from "@/server/auth/rbac";
import { getPublishedSetting } from "@/server/settings/settings-service";

export default async function AdminThemePage() {
  await requireAdmin();
  const theme = (await getPublishedSetting(CMS_KEYS.siteTheme)) as CmsSiteTheme;
  return (
    <SiteThemeManager initial={JSON.parse(JSON.stringify(theme)) as CmsSiteTheme} />
  );
}
