export type AdminNavItem = {
  href: string;
  label: string;
  aiOnly?: boolean;
};

export const ADMIN_NAV: AdminNavItem[] = [
  { href: "/admin/dashboard", label: "ภาพรวม" },
  { href: "/admin/users", label: "ผู้ใช้" },
  { href: "/admin/categories", label: "หมวดหมู่" },
  { href: "/admin/prompts", label: "Prompt / Persona", aiOnly: true },
  { href: "/admin/ai-configs", label: "AI Models", aiOnly: true },
  { href: "/admin/knowledge", label: "คลังความรู้", aiOnly: true },
  { href: "/admin/packages", label: "แพ็กเกจ" },
  { href: "/admin/payments", label: "การชำระเงิน" },
  { href: "/admin/usage", label: "Usage / AI Logs", aiOnly: true },
  { href: "/admin/audit-logs", label: "Audit Logs" },
];

export function filterAdminNav(aiAdmin: boolean) {
  return ADMIN_NAV.filter((item) => aiAdmin || !item.aiOnly);
}
