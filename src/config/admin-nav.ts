export type AdminNavGroupId = "content" | "ai" | "users" | "system";

export type AdminNavItem = {
  href: string;
  label: string;
  aiOnly?: boolean;
  group: AdminNavGroupId;
};

export const ADMIN_NAV_GROUPS: {
  id: AdminNavGroupId;
  label: string;
}[] = [
  { id: "content", label: "คอนเทนต์เว็บ" },
  { id: "ai", label: "ดูดวงและ AI" },
  { id: "users", label: "ผู้ใช้และรายได้" },
  { id: "system", label: "ระบบ" },
];

export const ADMIN_NAV: AdminNavItem[] = [
  { href: "/admin/dashboard", label: "ภาพรวม", group: "system" },
  { href: "/admin/landing", label: "หน้าแรกและการตลาด", group: "content" },
  { href: "/admin/theme", label: "โลโก้ & ธีม", group: "content" },
  { href: "/admin/settings", label: "ข้อความเว็บ", group: "content" },
  { href: "/admin/faq", label: "คำถามที่พบบ่อย", group: "content" },
  { href: "/admin/announcements", label: "ประกาศแบนเนอร์", group: "content" },
  { href: "/admin/categories", label: "หมวดดูดวง", group: "ai" },
  { href: "/admin/prompts", label: "บุคลิก AI", aiOnly: true, group: "ai" },
  { href: "/admin/ai-configs", label: "โมเดล AI", aiOnly: true, group: "ai" },
  { href: "/admin/knowledge", label: "คลังความรู้", aiOnly: true, group: "ai" },
  { href: "/admin/feedback", label: "ฟีดแบ็กคำตอบ", aiOnly: true, group: "ai" },
  { href: "/admin/usage", label: "บันทึกการใช้งาน AI", aiOnly: true, group: "ai" },
  { href: "/admin/analytics", label: "กราฟการใช้งาน", aiOnly: true, group: "ai" },
  { href: "/admin/costs", label: "ต้นทุนและกำไร", aiOnly: true, group: "users" },
  { href: "/admin/users", label: "ผู้ใช้", group: "users" },
  { href: "/admin/packages", label: "แพ็กเกจและโควตา", group: "users" },
  { href: "/admin/payments", label: "ตรวจการโอนเงิน", group: "users" },
  { href: "/admin/errors", label: "Error ของระบบ", group: "system" },
  { href: "/admin/audit-logs", label: "ประวัติแอดมิน", group: "system" },
];

export function filterAdminNav(aiAdmin: boolean) {
  return ADMIN_NAV.filter((item) => aiAdmin || !item.aiOnly);
}

export function groupedAdminNav(aiAdmin: boolean) {
  const items = filterAdminNav(aiAdmin);
  return ADMIN_NAV_GROUPS.map((group) => ({
    ...group,
    items: items.filter((i) => i.group === group.id),
  })).filter((g) => g.items.length > 0);
}
