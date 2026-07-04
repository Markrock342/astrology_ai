import { AccountView } from "@/components/account/account-view";
import { listPublicPackages } from "@/server/admin/catalog-admin-service";
import { getMyPackage } from "@/server/user/account-service";
import { requireSessionUserId } from "@/server/auth/session-guard";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const userId = await requireSessionUserId();

  const [myPackage, packages] = await Promise.all([
    getMyPackage(userId),
    listPublicPackages(),
  ]);

  const proPkg = packages.find((p) => p.type === "PRO");

  return (
    <AccountView
      myPackage={myPackage}
      packages={packages}
      upgradeSteps={proPkg?.upgradeSteps ?? []}
    />
  );
}
