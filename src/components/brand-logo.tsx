import Image from "next/image";
import { APP_NAME_TH, APP_TAGLINE_TH, APP_WORDMARK } from "@/config/constants";

const wordmarkClass =
  "font-[family-name:var(--font-wordmark)] font-bold lowercase tracking-wide text-[var(--primary)]";

/** Brand mark — replace public/logo.svg when the client sends final artwork. */
export function BrandMark({ size = 40 }: { size?: number }) {
  return (
    <Image
      src="/logo.svg"
      alt={APP_NAME_TH}
      width={size}
      height={size}
      priority
      className="shrink-0 object-contain"
    />
  );
}

/** Latin wordmark from client PSD. */
export function BrandWordmark({
  className = "",
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizes = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-2xl",
  };
  return (
    <span className={`${wordmarkClass} ${sizes[size]} ${className}`}>{APP_WORDMARK}</span>
  );
}

/** Thai tagline from client PSD. */
export function BrandTagline({
  className = "",
  size = "sm",
}: {
  className?: string;
  size?: "xs" | "sm";
}) {
  const sizes = {
    xs: "text-[10px] leading-snug",
    sm: "text-xs leading-snug",
  };
  return (
    <p className={`text-[var(--foreground)]/90 ${sizes[size]} ${className}`}>{APP_TAGLINE_TH}</p>
  );
}

/** Full vertical lockup — login / auth pages (logo + wordmark + tagline). */
export function BrandLogo({
  size = 40,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center gap-2 text-center ${className}`}>
      <BrandMark size={size} />
      <BrandWordmark size="lg" />
      <BrandTagline size="sm" className="max-w-[280px]" />
    </div>
  );
}

/** Horizontal lockup for sidebar / mobile header. */
export function BrandLockup({
  markSize = 28,
  className = "",
  showTagline = true,
}: {
  markSize?: number;
  className?: string;
  showTagline?: boolean;
}) {
  return (
    <div className={`flex min-w-0 items-center gap-2.5 ${className}`}>
      <BrandMark size={markSize} />
      <div className="min-w-0 leading-tight">
        <BrandWordmark size="sm" className="block" />
        {showTagline && <BrandTagline size="xs" className="mt-0.5 line-clamp-2" />}
      </div>
    </div>
  );
}
