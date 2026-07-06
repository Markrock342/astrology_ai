const common = { viewBox: "0 0 24 24", fill: "none" } as const;
const stroke = {
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** Category nav icons — gold outline style from client PSD. */
export function CategoryIcon({
  slug,
  size = 18,
  className = "",
}: {
  slug: string;
  size?: number;
  className?: string;
}) {
  const props = { ...common, width: size, height: size, className, "aria-hidden": true as const };

  switch (slug) {
    case "self":
      return (
        <svg {...props}>
          <circle cx="12" cy="8.5" r="3.5" {...stroke} />
          <path d="M5 20c.8-3.5 3.8-5.5 7-5.5s6.2 2 7 5.5" {...stroke} />
        </svg>
      );
    case "career":
      return (
        <svg {...props}>
          <rect x="4" y="8" width="16" height="11" rx="1.5" {...stroke} />
          <path d="M9 8V6a3 3 0 0 1 6 0v2" {...stroke} />
          <path d="M4 13h16" {...stroke} />
        </svg>
      );
    case "finance":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="7.5" {...stroke} />
          <path d="M12 8v8M14.2 10.2c-.5-.6-1.2-.9-2-.9-1 0-1.8.5-1.8 1.4 0 1.8 3.8 1 3.8 2.9 0 .9-.8 1.5-2 1.5-.8 0-1.5-.3-2-.8" {...stroke} />
        </svg>
      );
    case "love":
      return (
        <svg {...props}>
          <path
            d="M12 19.5c-1.2-1-5-3.6-5-7.2a3.2 3.2 0 0 1 5.4-2.3A3.2 3.2 0 0 1 17 12.3c0 3.6-3.8 6.2-5 7.2z"
            {...stroke}
          />
        </svg>
      );
    case "health":
      return (
        <svg {...props}>
          <path d="M12 20.5s-5.5-4.5-5.5-9a5.5 5.5 0 0 1 11 0c0 4.5-5.5 9-5.5 9z" {...stroke} />
          <path d="M12 9v6M9 12h6" {...stroke} />
        </svg>
      );
    case "fortune":
      return (
        <svg {...props}>
          <path
            d="M12 3c.6 4 1.6 5 5.4 5.4-3.8.4-4.8 1.4-5.4 5.4-.6-4-1.6-5-5.4-5.4C10.4 8 11.4 7 12 3z"
            {...stroke}
          />
          <path
            d="M18 16.5c.2 1.5.6 1.9 2.1 2.1-1.5.2-1.9.6-2.1 2.1-.2-1.5-.6-1.9-2.1-2.1 1.5-.2 1.9-.6 2.1-2.1z"
            {...stroke}
          />
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
