import { APP_NAME_TH } from "@/config/constants";

/** Gold constellation mark used in the sign-in card and sidebar header. */
export function BrandMark({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      className="text-[var(--primary)]"
    >
      <circle
        cx="24"
        cy="24"
        r="21"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.85"
      />
      {/* constellation */}
      <path
        d="M17 28 L23 17 L30 22 L27 31 Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
        opacity="0.9"
      />
      <circle cx="17" cy="28" r="1.7" fill="currentColor" />
      <circle cx="23" cy="17" r="1.7" fill="currentColor" />
      <circle cx="30" cy="22" r="1.7" fill="currentColor" />
      <circle cx="27" cy="31" r="1.7" fill="currentColor" />
      <circle cx="24" cy="24" r="1" fill="currentColor" opacity="0.7" />
    </svg>
  );
}

/** Full brand lockup: mark + Thai name + latin wordmark. */
export function BrandLogo({
  size = 40,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center gap-1 ${className}`}>
      <BrandMark size={size} />
      <span className="text-lg font-semibold tracking-wide text-[var(--primary)]">
        {APP_NAME_TH}
      </span>
      <span className="text-[10px] font-medium uppercase tracking-[0.4em] text-[var(--muted-2)]">
        HORASARD
      </span>
    </div>
  );
}
