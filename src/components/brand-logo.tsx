import Image from "next/image";
import { APP_NAME_TH } from "@/config/constants";

/** Brand mark — replace public/logo.svg when the client sends final artwork. */
export function BrandMark({ size = 40 }: { size?: number }) {
  return (
    <Image
      src="/logo.svg"
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

/** Sidebar wordmark matching client mock (horosard in gold). */
export function BrandWordmark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`text-base font-semibold lowercase tracking-wide text-[var(--primary)] ${className}`}
    >
      horosard
    </span>
  );
}
