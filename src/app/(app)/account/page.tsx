import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AccountView } from "@/components/account/account-view";
import { listPublicPackages } from "@/server/admin/catalog-admin-service";
import { getMyPackage } from "@/server/user/account-service";

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [myPackage, packages] = await Promise.all([
    getMyPackage(session.user.id),
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
