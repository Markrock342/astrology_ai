import Link from "next/link";
import { BrandMark } from "@/components/brand-logo";
import { PublicBackButton } from "./public-back-button";

/**
 * One header for every public content page (pricing, help, contact, legal,
 * calculator): the same centred brand mark the home hero opens with, linking
 * back to it. Client request — the pages used to mix three different lockups.
 */
export function PublicPageHeader({ className = "" }: { className?: string }) {
  return (
    <div className={`relative flex min-h-14 items-center justify-center ${className}`}>
      <PublicBackButton />
      <Link
        href="/"
        aria-label="กลับหน้าแรก"
        className="press-scale inline-flex rounded-full"
      >
        <BrandMark size={56} />
      </Link>
    </div>
  );
}
