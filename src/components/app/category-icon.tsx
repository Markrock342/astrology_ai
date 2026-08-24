const common = { viewBox: "0 0 24 24", fill: "none" } as const;
const stroke = {
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

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

/** Category nav icons — gold outline defaults, or admin-uploaded image. */
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

  const props = {
    ...common,
    width: size,
    height: size,
    className,
    "aria-hidden": true as const,
  };

  switch (slug) {
    case "self":
      return (
        <svg {...props}>
          <circle cx="12" cy="8" r="3.4" {...stroke} />
          <path d="M5.5 19.5c1-3.6 3.6-5.5 6.5-5.5s5.5 1.9 6.5 5.5" {...stroke} />
        </svg>
      );
    case "career":
      return (
        <svg {...props}>
          <rect x="3.5" y="8" width="17" height="11.5" rx="2" {...stroke} />
          <path d="M9 8V6.5a3 3 0 0 1 6 0V8" {...stroke} />
          <path d="M3.5 13h17" {...stroke} />
        </svg>
      );
    case "finance":
      return (
        <svg {...props}>
          <ellipse cx="10" cy="16.5" rx="5.5" ry="2.2" {...stroke} />
          <path d="M4.5 16.5V13c0 1.2 2.5 2.2 5.5 2.2s5.5-1 5.5-2.2v3.5" {...stroke} />
          <ellipse cx="14" cy="11" rx="5.5" ry="2.2" {...stroke} />
          <path d="M8.5 11V7.8c0 1.2 2.5 2.2 5.5 2.2s5.5-1 5.5-2.2V11" {...stroke} />
          <ellipse cx="14" cy="7.8" rx="5.5" ry="2.2" {...stroke} />
        </svg>
      );
    case "love":
      return (
        <svg {...props}>
          <path
            d="M12 19.2c-1.1-.9-5.2-3.8-5.2-7.4A3.4 3.4 0 0 1 12 9.2a3.4 3.4 0 0 1 5.2 2.6c0 3.6-4.1 6.5-5.2 7.4z"
            {...stroke}
          />
        </svg>
      );
    case "health":
      return (
        <svg {...props}>
          <path
            d="M12 3.5l6.5 2.2v5.6c0 4.2-2.8 7.4-6.5 9.2-3.7-1.8-6.5-5-6.5-9.2V5.7L12 3.5z"
            {...stroke}
          />
          <path d="M12 9v5.5M9.2 11.8h5.6" {...stroke} />
        </svg>
      );
    case "fortune":
      return (
        <svg {...props}>
          <circle cx="12" cy="7.5" r="3.1" {...stroke} />
          <circle cx="8" cy="13" r="3.1" {...stroke} />
          <circle cx="16" cy="13" r="3.1" {...stroke} />
          <path d="M12 15.2v5.3" {...stroke} />
        </svg>
      );
    case "overview":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="8" {...stroke} />
          <path d="M14.8 9.2 10.5 10.5 9.2 14.8l4.3-1.3z" {...stroke} />
          <circle cx="12" cy="12" r="1.1" {...stroke} />
        </svg>
      );
    default:
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="7" {...stroke} />
        </svg>
      );
  }
}
