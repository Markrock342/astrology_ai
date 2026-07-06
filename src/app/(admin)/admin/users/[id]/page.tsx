import { auth } from "@/auth";
import { UserDetailManager } from "@/components/admin/user-detail-manager";

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const isSuperAdmin = session?.user?.role === "SUPER_ADMIN";
  return <UserDetailManager userId={id} isSuperAdmin={isSuperAdmin} />;
}
