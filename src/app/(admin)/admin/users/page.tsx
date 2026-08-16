import { UsersManager } from "@/components/admin/users-manager";
import { auth } from "@/auth";

export default async function AdminUsersPage() {
  const session = await auth();
  const role = session?.user?.role;
  const actorRole =
    role === "SUPER_ADMIN" ? "SUPER_ADMIN" : ("ADMIN" as const);
  return <UsersManager actorRole={actorRole} />;
}
