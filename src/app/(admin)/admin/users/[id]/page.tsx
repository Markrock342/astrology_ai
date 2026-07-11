import { auth } from "@/auth";
import { UserDetailManager } from "@/components/admin/user-detail-manager";

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const role = session?.user?.role;
  const actorRole =
    role === "SUPER_ADMIN" ? "SUPER_ADMIN" : ("ADMIN" as const);
  return <UserDetailManager userId={id} actorRole={actorRole} />;
}
