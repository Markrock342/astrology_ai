import { AccountView } from "@/components/account/account-view";
import { CMS_DEFAULTS, CMS_KEYS, type CmsPaymentInfo } from "@/lib/cms-keys";
import { listPublicPackages } from "@/server/admin/catalog-admin-service";
import { getPaymentInfo } from "@/server/settings/settings-service";
import { getMe, getMyPackage } from "@/server/user/account-service";
import { requireSessionUserId } from "@/server/auth/session-guard";

export const dynamic = "force-dynamic";

/**
 * Soft-fail optional catalog/CMS fetches so a CMS/DB blip cannot blank the
 * whole (app) segment with the branded error screen.
 */
export default async function AccountPage() {
  const userId = await requireSessionUserId();
  const me = await getMe(userId);

  const [pkgResult, packagesResult, paymentResult] = await Promise.allSettled([
    getMyPackage(userId),
    listPublicPackages(),
    getPaymentInfo(),
  ]);

  const myPackage =
    pkgResult.status === "fulfilled"
      ? pkgResult.value
      : {
          plan: me.plan,
          creditBalance: me.creditBalance,
          subscription: null,
        };

  const packages =
    packagesResult.status === "fulfilled" ? packagesResult.value : [];

  const paymentInfo: CmsPaymentInfo =
    paymentResult.status === "fulfilled"
      ? paymentResult.value
      : (CMS_DEFAULTS[CMS_KEYS.paymentInfo] as CmsPaymentInfo);

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
    />
  );
}
