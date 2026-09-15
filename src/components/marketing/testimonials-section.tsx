import type { CmsLandingTestimonial, CmsLandingTestimonials } from "@/lib/cms-keys";
import { SectionHeader } from "@/components/marketing/section-header";

function Stars({ stars }: { stars: number }) {
  const n = Math.max(0, Math.min(5, stars));
  return (
    <span
      className="text-xs tracking-wide text-[var(--primary)]"
      aria-label={`${n} ดาว`}
      role="img"
    >
      {"★".repeat(n)}
      <span className="opacity-30">{"★".repeat(5 - n)}</span>
    </span>
  );
}

function Lead({ item }: { item: CmsLandingTestimonial }) {
  return (
    <figure className="animate-fade-up stagger-1 mt-12">
      <blockquote className="max-w-3xl text-2xl font-light leading-snug tracking-tight text-[var(--foreground)] sm:text-4xl">
        “{item.quote}”
      </blockquote>
      <figcaption className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="font-medium text-[var(--foreground)]">{item.name}</span>
        <Stars stars={item.stars} />
      </figcaption>
    </figure>
  );
}

/** First testimonial as a large pull-quote, the rest as compact text rows. */
export function TestimonialsSection({
  testimonials,
}: {
  testimonials: CmsLandingTestimonials;
}) {
  if (!testimonials.enabled || !testimonials.items?.length) return null;
  const [lead, ...rest] = testimonials.items;

  return (
    <section className="px-6 py-16">
      <div className="mx-auto max-w-5xl">
        <SectionHeader
          title={testimonials.title}
          subtitle={testimonials.subtitle}
          align="left"
        />

        <Lead item={lead} />

        {rest.length > 0 ? (
          <ul className="mt-14 border-t border-[var(--primary)]/25">
            {rest.map((item, i) => (
              <li
                key={`${item.name}-${i}`}
                className={`animate-fade-up stagger-${Math.min(i + 2, 6)} grid gap-2 border-b border-[var(--border)] py-5 sm:grid-cols-[10rem_1fr] sm:gap-8`}
              >
                <div className="flex items-center gap-3 sm:flex-col sm:items-start sm:gap-1">
                  <span className="text-sm font-medium text-[var(--foreground)]">
                    {item.name}
                  </span>
                  <Stars stars={item.stars} />
                </div>
                <blockquote className="max-w-[65ch] text-sm leading-relaxed text-[var(--muted)] sm:text-base">
                  {item.quote}
                </blockquote>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
