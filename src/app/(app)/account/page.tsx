import { AccountView } from "@/components/account/account-view";
import { listPublicPackages } from "@/server/admin/catalog-admin-service";
import { getPaymentInfo } from "@/server/settings/settings-service";
import { getMe, getMyPackage } from "@/server/user/account-service";
import { requireSessionUserId } from "@/server/auth/session-guard";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const userId = await requireSessionUserId();

  const [me, myPackage, packages, paymentInfo] = await Promise.all([
    getMe(userId),
    getMyPackage(userId),
    listPublicPackages(),
    getPaymentInfo(),
  ]);

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
