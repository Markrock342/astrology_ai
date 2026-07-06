import Image from "next/image";
import {
  APP_NAME_TH,
  APP_TAGLINE_SUB_TH,
  APP_TAGLINE_TH,
  APP_WORDMARK,
} from "@/config/constants";

/** Native aspect ratio of public/wordmark.png (700 x 113). */
const WORDMARK_RATIO = 700 / 113;

/** Brand mark — client's gold monogram (public/logo.png). */
export function BrandMark({ size = 40 }: { size?: number }) {
  return (
    <Image
      src="/logo.png"
      alt={APP_NAME_TH}
      width={size}
      height={size}
      priority
      unoptimized
      className="shrink-0 object-contain"
    />
  );
}

/**
 * Latin wordmark from the client design — rendered as the exact artwork
 * (public/wordmark.png) rather than a font, so it always matches the brand.
 */
export function BrandWordmark({
  className = "",
  height = 22,
}: {
  className?: string;
  height?: number;
}) {
  return (
    <Image
      src="/wordmark.png"
      alt={APP_WORDMARK}
      width={Math.round(height * WORDMARK_RATIO)}
      height={height}
      priority
      unoptimized
      className={`w-auto object-contain ${className}`}
    />
  );
}

/** Thai tagline(s) from the client design. */
export function BrandTagline({
  className = "",
  size = "sm",
  showSub = false,
}: {
  className?: string;
  size?: "xs" | "sm";
  showSub?: boolean;
}) {
  const sizes = {
    xs: "text-[10px] leading-snug",
    sm: "text-xs leading-snug",
  };
  return (
    <div className={className}>
      <h1 className={`font-medium text-[var(--foreground)]/90 ${sizes[size]}`}>
        {APP_TAGLINE_TH}
      </h1>
      {showSub && (
        <h2 className={`mt-1 font-normal text-[var(--muted)] ${sizes[size]}`}>
          {APP_TAGLINE_SUB_TH}
        </h2>
      )}
    </div>
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
    <div className={`flex flex-col items-center gap-3 text-center ${className}`}>
      <BrandMark size={size} />
      <BrandWordmark height={38} />
      <BrandTagline size="sm" showSub className="max-w-[340px]" />
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
        <BrandWordmark height={18} className="block" />
        {showTagline && (
          <p className="mt-1 line-clamp-1 text-[10px] leading-snug text-[var(--muted)]">
            {APP_TAGLINE_TH}
          </p>
        )}
      </div>
    </div>
  );
}
