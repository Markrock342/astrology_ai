import type { CmsLandingFeatures } from "@/lib/cms-keys";

export function FeaturesSection({ features }: { features: CmsLandingFeatures }) {
  if (!features.items?.length) return null;

  return (
    <section className="border-t border-[var(--border)] bg-[var(--surface)]/40 px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-semibold text-[var(--foreground)] sm:text-3xl">
            {features.title}
          </h2>
          {features.subtitle ? (
            <p className="mt-3 text-sm leading-relaxed text-[var(--muted)] sm:text-base">
              {features.subtitle}
            </p>
          ) : null}
        </div>

        <ul className="mt-12 grid gap-5 sm:grid-cols-2">
          {features.items.map((item, i) => (
            <li
              key={`${item.title}-${i}`}
              className={`animate-fade-up stagger-${Math.min(i + 1, 6)} rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6`}
            >
              <div className="flex items-start gap-4">
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)]/10 text-xl"
                  aria-hidden
                >
                  {item.icon}
                </span>
                <div>
                  <h3 className="text-base font-semibold text-[var(--foreground)]">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
                    {item.description}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
