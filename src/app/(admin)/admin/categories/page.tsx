import { CategoriesManager } from "@/components/admin/categories-manager";
import { requireAdmin } from "@/server/auth/rbac";
import { listCategories } from "@/server/admin/catalog-admin-service";

export default async function AdminCategoriesPage() {
  await requireAdmin();
  const categories = await listCategories();
  return (
    <CategoriesManager
      initialCategories={JSON.parse(JSON.stringify(categories)) as never}
    />
  );
}
