export type AppPlanLabelUser = {
  role: "USER" | "ADMIN" | "SUPER_ADMIN";
  plan: "FREE" | "PRO";
  packageName?: string | null;
};

/** Shell label: staff role wins; paid users see the real package name. */
export function appPlanLabel(user: AppPlanLabelUser | null | undefined): string {
  if (user?.role === "SUPER_ADMIN") return "Super Admin";
  if (user?.role === "ADMIN") return "Admin";
  if (user?.plan === "PRO") return user.packageName?.trim() || "Pro";
  return "Free";
}
