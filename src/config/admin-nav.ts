import {
  BookOpen,
  ChartColumn,
  CircleHelp,
  Cpu,
  Drama,
  FileSearch,
  History,
  House,
  LayoutDashboard,
  ListChecks,
  Megaphone,
  MessageSquareHeart,
  Orbit,
  Package,
  Palette,
  ReceiptText,
  ScrollText,
  TrendingUp,
  TriangleAlert,
  Type,
  Users,
  type LucideIcon,
} from "lucide-react";

/**
 * Admin sidebar, in the order the team reaches for things: the overview,
 * then people and money, then the reading itself, the AI behind it, the
 * public site, and the system logs.
 */
export type AdminNavGroupId = "overview" | "users" | "reading" | "ai" | "content" | "system";

export type AdminNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  aiOnly?: boolean;
  group: AdminNavGroupId;
};

export const ADMIN_NAV_GROUPS: {
  id: AdminNavGroupId;
  /** Null for the top group, which needs no heading. */
  label: string | null;
}[] = [
  { id: "overview", label: null },
  { id: "users", label: "ผู้ใช้และรายได้" },
  { id: "reading", label: "การดูดวง" },
  { id: "ai", label: "AI และคุณภาพคำตอบ" },
  { id: "content", label: "คอนเทนต์เว็บ" },
  { id: "system", label: "ระบบ" },
];

export const ADMIN_NAV: AdminNavItem[] = [
  { href: "/admin/dashboard", label: "ภาพรวม", icon: LayoutDashboard, group: "overview" },

  { href: "/admin/users", label: "ผู้ใช้", icon: Users, group: "users" },
  { href: "/admin/payments", label: "ตรวจการโอนเงิน", icon: ReceiptText, group: "users" },
  { href: "/admin/packages", label: "แพ็กเกจและคำถาม", icon: Package, group: "users" },
  { href: "/admin/costs", label: "ต้นทุนและกำไร", icon: TrendingUp, aiOnly: true, group: "users" },

  { href: "/admin/categories", label: "หมวดดูดวง", icon: Orbit, group: "reading" },
  { href: "/admin/prompts", label: "บุคลิก AI", icon: Drama, aiOnly: true, group: "reading" },
  { href: "/admin/knowledge", label: "คลังความรู้", icon: BookOpen, aiOnly: true, group: "reading" },
  { href: "/admin/chart-standards", label: "มาตรฐานและเกณฑ์", icon: ListChecks, aiOnly: true, group: "reading" },

  { href: "/admin/ai-configs", label: "โมเดล AI", icon: Cpu, aiOnly: true, group: "ai" },
  { href: "/admin/readings", label: "ตรวจสอบการอ่าน", icon: FileSearch, aiOnly: true, group: "ai" },
  { href: "/admin/feedback", label: "ฟีดแบ็กคำตอบ", icon: MessageSquareHeart, aiOnly: true, group: "ai" },
  { href: "/admin/usage", label: "บันทึกการใช้งาน AI", icon: ScrollText, aiOnly: true, group: "ai" },
  { href: "/admin/analytics", label: "กราฟการใช้งาน", icon: ChartColumn, aiOnly: true, group: "ai" },

  { href: "/admin/landing", label: "หน้าแรกและการตลาด", icon: House, group: "content" },
  { href: "/admin/theme", label: "โลโก้ & ธีม", icon: Palette, group: "content" },
  { href: "/admin/settings", label: "ข้อความเว็บ", icon: Type, group: "content" },
  { href: "/admin/faq", label: "คำถามที่พบบ่อย", icon: CircleHelp, group: "content" },
  { href: "/admin/announcements", label: "ประกาศแบนเนอร์", icon: Megaphone, group: "content" },

  { href: "/admin/errors", label: "Error ของระบบ", icon: TriangleAlert, group: "system" },
  { href: "/admin/audit-logs", label: "ประวัติแอดมิน", icon: History, group: "system" },
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
