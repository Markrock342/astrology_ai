import Image from "next/image";
import Link from "next/link";
import { BrandMark } from "@/components/brand-logo";
import type { CmsLandingHero } from "@/lib/cms-keys";

export function HeroSection({ hero }: { hero: CmsLandingHero }) {
  const hasImage = Boolean(hero.imageUrl?.trim());

  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(201,162,75,0.18),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(18,143,122,0.12),transparent_45%)]"
      />
      <div className="relative mx-auto flex max-w-5xl flex-col items-center px-6 pb-20 pt-16 text-center sm:pb-28 sm:pt-24">
        <div className="animate-fade-up">
          <BrandMark size={64} />
        </div>
        {hero.eyebrow ? (
          <p className="animate-fade-up stagger-1 mt-6 text-xs uppercase tracking-[0.35em] text-[var(--muted-2)]">
            {hero.eyebrow}
          </p>
        ) : null}
        <h1 className="animate-fade-up stagger-2 mt-3 text-4xl font-semibold tracking-tight text-[var(--primary)] sm:text-6xl">
          {hero.headline}
        </h1>
        <p className="animate-fade-up stagger-3 mt-5 max-w-xl text-base leading-relaxed text-[var(--muted)] sm:text-lg">
          {hero.subheadline}
        </p>
        <div className="animate-fade-up stagger-4 mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link
            href={hero.primaryCta.href}
            className="rounded-full bg-[var(--primary)] px-7 py-3 text-sm font-semibold text-[var(--primary-foreground)] transition hover:bg-[var(--primary-hover)]"
          >
            {hero.primaryCta.text}
          </Link>
          <Link
            href={hero.secondaryCta.href}
            className="rounded-full border border-[var(--border)] px-7 py-3 text-sm font-medium text-[var(--foreground)] transition hover:border-[var(--primary)]/50 hover:bg-[var(--surface-2)]"
          >
            {hero.secondaryCta.text}
          </Link>
        </div>

        {hasImage ? (
          <div className="animate-fade-up stagger-5 relative mt-14 w-full max-w-3xl overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl shadow-black/30">
            <Image
              src={hero.imageUrl!}
              alt=""
              width={1200}
              height={720}
              className="h-auto w-full object-cover"
              unoptimized
              priority
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}
