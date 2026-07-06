export type AdminNavItem = {
  href: string;
  label: string;
  aiOnly?: boolean;
};

export const ADMIN_NAV: AdminNavItem[] = [
  { href: "/admin/dashboard", label: "ภาพรวม" },
  { href: "/admin/users", label: "ผู้ใช้" },
  { href: "/admin/categories", label: "หมวดดูดวง" },
  { href: "/admin/prompts", label: "บุคลิก AI", aiOnly: true },
  { href: "/admin/ai-configs", label: "โมเดล AI", aiOnly: true },
  { href: "/admin/knowledge", label: "คลังความรู้", aiOnly: true },
  { href: "/admin/packages", label: "แพ็กเกจ & โควตา" },
  { href: "/admin/settings", label: "ข้อความเว็บ" },
  { href: "/admin/payments", label: "ตรวจการโอนเงิน" },
  { href: "/admin/usage", label: "บันทึก AI", aiOnly: true },
  { href: "/admin/audit-logs", label: "ประวัติแอดมิน" },
];

export function filterAdminNav(aiAdmin: boolean) {
  return ADMIN_NAV.filter((item) => aiAdmin || !item.aiOnly);
}
