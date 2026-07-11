import type { CmsLandingTestimonials } from "@/lib/cms-keys";

export function TestimonialsSection({
  testimonials,
}: {
  testimonials: CmsLandingTestimonials;
}) {
  if (!testimonials.enabled || !testimonials.items?.length) return null;

  return (
    <section className="px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-semibold text-[var(--foreground)] sm:text-3xl">
            {testimonials.title}
          </h2>
          {testimonials.subtitle ? (
            <p className="mt-3 text-sm leading-relaxed text-[var(--muted)] sm:text-base">
              {testimonials.subtitle}
            </p>
          ) : null}
        </div>

        <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {testimonials.items.map((item, i) => (
            <li
              key={`${item.name}-${i}`}
              className={`animate-fade-up stagger-${Math.min(i + 1, 6)} flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6`}
            >
              <div
                className="flex gap-0.5 text-[var(--primary)]"
                aria-label={`${item.stars} ดาว`}
              >
                {Array.from({ length: 5 }).map((_, s) => (
                  <span key={s} className={s < item.stars ? "opacity-100" : "opacity-25"}>
                    ★
                  </span>
                ))}
              </div>
              <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-[var(--muted)]">
                “{item.quote}”
              </blockquote>
              <p className="mt-5 text-sm font-medium text-[var(--foreground)]">
                {item.name}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
