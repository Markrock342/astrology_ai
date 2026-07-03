const common = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none" } as const;
const stroke = {
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function CategoryIcon({ slug }: { slug: string }) {
  switch (slug) {
    case "self":
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="4" {...stroke} />
          <path d="M4 21c0-4 3.5-6 8-6s8 2 8 6" {...stroke} />
        </svg>
      );
    case "career":
      return (
        <svg {...common}>
          <rect x="3" y="7" width="18" height="13" rx="2" {...stroke} />
          <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" {...stroke} />
        </svg>
      );
    case "finance":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.5" {...stroke} />
          <path
            d="M12 7.5v9M14 9.7c-.6-.7-1.4-1-2.2-1-1.1 0-2 .6-2 1.6 0 2 4.4 1.1 4.4 3.2 0 1-.9 1.7-2.2 1.7-.9 0-1.7-.4-2.2-1.1"
            {...stroke}
          />
        </svg>
      );
    case "love":
      return (
        <svg {...common}>
          <path
            d="M12 20s-7-4.5-7-9a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 4.5-7 9-7 9z"
            {...stroke}
          />
        </svg>
      );
    case "health":
      return (
        <svg {...common}>
          <path d="M12 21s-6-5.1-6-10a6 6 0 1 1 12 0c0 4.9-6 10-6 10z" {...stroke} />
          <circle cx="12" cy="11" r="2.3" {...stroke} />
        </svg>
      );
    case "fortune":
      return (
        <svg {...common}>
          <path
            d="M12 2.5c.7 4.9 1.9 6.1 6.8 6.8-4.9.7-6.1 1.9-6.8 6.8-.7-4.9-1.9-6.1-6.8-6.8 4.9-.7 6.1-1.9 6.8-6.8z"
            {...stroke}
          />
          <path
            d="M18.5 15.5c.3 1.9.8 2.4 2.7 2.7-1.9.3-2.4.8-2.7 2.7-.3-1.9-.8-2.4-2.7-2.7 1.9-.3 2.4-.8 2.7-2.7z"
            {...stroke}
          />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" {...stroke} />
        </svg>
      );
  }
}
