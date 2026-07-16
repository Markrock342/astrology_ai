/** Sidebar / nav icons — gold-outline style from Website_Design.psd. */

type IconProps = { size?: number; className?: string };

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  xmlns: "http://www.w3.org/2000/svg",
});

export function MenuIcon({ size = 20, className = "" }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function SearchIcon({ size = 16, className = "" }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M20 20l-4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/** Green circle + plus — primary CTA in sidebar. */
export function NewChatIcon({ size = 20, className = "" }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <circle cx="12" cy="12" r="10" fill="var(--secondary-active)" />
      <path
        d="M12 8v8M8 12h8"
        stroke="var(--secondary-foreground)"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function NewChatIconCompact({ size = 16, className = "" }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <circle cx="12" cy="12" r="10" fill="currentColor" className="text-[var(--secondary-active)]" />
      <path
        d="M12 8v8M8 12h8"
        stroke="var(--secondary-foreground)"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function GearIcon({ size = 18, className = "" }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <circle cx="12" cy="12" r="2.8" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4l1.4-1.4M17 7l1.4-1.4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Light / dark theme — sun (switch to light). */
export function SunIcon({ size = 18, className = "" }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.05 5.05l1.55 1.55M17.4 17.4l1.55 1.55M5.05 18.95l1.55-1.55M17.4 6.6l1.55-1.55"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Light / dark theme — moon (switch to dark). */
export function MoonIcon({ size = 18, className = "" }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <path
        d="M19.5 13.4A7.5 7.5 0 0 1 10.6 4.5 7.6 7.6 0 1 0 19.5 13.4Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Custom theme — palette swatches. */
export function PaletteIcon({ size = 18, className = "" }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <path
        d="M12 3.5a8.5 8.5 0 1 0 0 17c1.4 0 2.2-.9 2.2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.3a2.2 2.2 0 0 1 2.2-2.2H17A4.5 4.5 0 0 0 12 3.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="7.5" cy="10" r="1.1" fill="currentColor" />
      <circle cx="9.2" cy="7" r="1.1" fill="currentColor" />
      <circle cx="12.5" cy="6.2" r="1.1" fill="currentColor" />
      <circle cx="15.5" cy="8.2" r="1.1" fill="currentColor" />
    </svg>
  );
}

export function LockIcon({ size = 13, className = "" }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 11V8.5a4 4 0 0 1 8 0V11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/** Collapse sidebar (panel + narrow strip). */
export function CollapseSidebarIcon({ size = 20, className = "" }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
      <rect x="6" y="8" width="4" height="8" rx="1" fill="currentColor" />
    </svg>
  );
}

/** Expand sidebar — mirror of collapse. */
export function ExpandSidebarIcon({ size = 20, className = "" }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
      <rect x="6" y="8" width="4" height="8" rx="1" fill="currentColor" opacity="0.35" />
      <path d="M14 12h5M16.5 9.5 19 12l-2.5 2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Small transit / orbit icon for ดวงจร rows (when listed). */
export function TransitIcon({ size = 14, className = "" }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="16" cy="8" r="2" fill="currentColor" />
      <path d="M12 4v2M12 18v2M4 12h2M18 12h2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}
