import {
  Briefcase,
  Circle,
  Clover,
  Coins,
  Compass,
  Heart,
  ShieldPlus,
  UserRound,
  type LucideIcon,
} from "lucide-react";

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  self: UserRound,
  career: Briefcase,
  finance: Coins,
  love: Heart,
  health: ShieldPlus,
  fortune: Clover,
  overview: Compass,
};

const ICON_STROKE = 1.75;

/** Uploaded CMS / absolute URL — not a legacy seed key like "user". */
export function isCustomCategoryIcon(
  icon: string | null | undefined,
): icon is string {
  if (!icon) return false;
  return (
    icon.startsWith("/") ||
    icon.startsWith("http://") ||
    icon.startsWith("https://")
  );
}

/** Category nav icons — Lucide outline defaults, or admin-uploaded image. */
export function CategoryIcon({
  slug,
  icon,
  size = 18,
  className = "",
}: {
  slug: string;
  /** Custom URL (`/api/media/...`) or legacy seed key (ignored for drawing). */
  icon?: string | null;
  size?: number;
  className?: string;
}) {
  if (isCustomCategoryIcon(icon)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={icon}
        alt=""
        width={size}
        height={size}
        className={`category-custom-icon shrink-0 object-contain ${className}`}
        aria-hidden
      />
    );
  }

  const Icon = CATEGORY_ICONS[slug] ?? Circle;

  return (
    <Icon
      size={size}
      strokeWidth={ICON_STROKE}
      absoluteStrokeWidth
      className={`shrink-0 ${className}`}
      aria-hidden
    />
  );
}
