import Image from "next/image";
import { APP_NAME_TH } from "@/config/constants";

/** Real brand mark (public/logo.png). Shown in sidebar, sign-in, admin, etc. */
export function BrandMark({ size = 40 }: { size?: number }) {
  return (
    <Image
      src="/logo.png"
      alt={APP_NAME_TH}
      width={size}
      height={size}
      priority
      className="object-contain"
    />
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
