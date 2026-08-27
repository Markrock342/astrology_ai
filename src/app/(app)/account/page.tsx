import { AccountView } from "@/components/account/account-view";
import { CMS_DEFAULTS, CMS_KEYS, type CmsPaymentInfo } from "@/lib/cms-keys";
import { listPublicPackages } from "@/server/admin/catalog-admin-service";
import { getPaymentInfo } from "@/server/settings/settings-service";
import { getMe, getMyPackage } from "@/server/user/account-service";
import { requireSessionUserId } from "@/server/auth/session-guard";
import { getUserAiMemory } from "@/server/user/ai-memory-service";

export const dynamic = "force-dynamic";

/**
 * Soft-fail optional catalog/CMS fetches so a CMS/DB blip cannot blank the
 * whole (app) segment with the branded error screen.
 */
export default async function AccountPage() {
  const userId = await requireSessionUserId();
  const me = await getMe(userId);

  const [pkgResult, packagesResult, paymentResult, memoryResult] = await Promise.allSettled([
    getMyPackage(userId),
    listPublicPackages(),
    getPaymentInfo(),
    getUserAiMemory(userId),
  ]);

  const myPackage =
    pkgResult.status === "fulfilled"
      ? pkgResult.value
      : {
          plan: me.plan,
          creditBalance: me.creditBalance,
          usageRemainingPercent: me.usageRemainingPercent,
          usageUsedPercent: Math.max(0, 100 - me.usageRemainingPercent),
          usagePeriodEndsAt: me.proExpiresAt,
          subscription: null,
        };

  const packages =
    packagesResult.status === "fulfilled" ? packagesResult.value : [];

  const paymentInfo: CmsPaymentInfo =
    paymentResult.status === "fulfilled"
      ? paymentResult.value
      : (CMS_DEFAULTS[CMS_KEYS.paymentInfo] as CmsPaymentInfo);

  const aiMemory =
    memoryResult.status === "fulfilled"
      ? memoryResult.value
      : {
          enabled: true,
          nickname: null,
          resetAt: null,
          commonTopics: [],
          recentQuestions: [],
        };

  return (
    <AccountView
      profile={{
        name: me.name ?? me.email.split("@")[0],
        email: me.email,
        image: me.image ?? null,
        canUploadAvatar: me.hasPassword,
      }}
      myPackage={myPackage}
      packages={packages}
      paymentInfo={paymentInfo}
      aiMemory={aiMemory}
    />
  );
}
