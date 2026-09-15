import type { CmsLandingFeatures } from "@/lib/cms-keys";
import { SectionHeader } from "@/components/marketing/section-header";

/**
 * Two-column list separated by gold hairlines. The CMS `icon` field is kept
 * for the admin schema but intentionally not rendered.
 */
export function FeaturesSection({ features }: { features: CmsLandingFeatures }) {
  if (!features.items?.length) return null;

  return (
    <section className="border-t border-[var(--border)] bg-[var(--surface)]/40 px-6 py-24">
      <div className="mx-auto max-w-5xl">
        <SectionHeader title={features.title} subtitle={features.subtitle} />

        <ul className="mt-14 grid sm:grid-cols-2 sm:gap-x-12">
          {features.items.map((item, i) => (
            <li
              key={`${item.title}-${i}`}
              className={`animate-fade-up stagger-${Math.min(i + 1, 6)} border-t border-[var(--primary)]/25 py-7`}
            >
              <h3 className="text-base font-semibold text-[var(--foreground)]">
                {item.title}
              </h3>
              <p className="mt-2 max-w-[65ch] text-sm leading-relaxed text-[var(--muted)]">
                {item.description}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
