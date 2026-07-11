import { PackagesManager } from "@/components/admin/packages-manager";
import { requireAdmin } from "@/server/auth/rbac";
import { listPackages } from "@/server/admin/catalog-admin-service";

export default async function AdminPackagesPage() {
  await requireAdmin();
  const packages = await listPackages();
  return (
    <PackagesManager
      initialPackages={JSON.parse(JSON.stringify(packages)) as never}
    />
  );
}
