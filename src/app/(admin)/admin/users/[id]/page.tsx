import { UserDetailManager } from "@/components/admin/user-detail-manager";

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <UserDetailManager userId={id} />;
}
