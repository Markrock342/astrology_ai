import type { CmsLandingHowItWorks } from "@/lib/cms-keys";

export function HowItWorksSection({ how }: { how: CmsLandingHowItWorks }) {
  if (!how.steps?.length) return null;

  return (
    <section className="px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-semibold text-[var(--foreground)] sm:text-3xl">
            {how.title}
          </h2>
          {how.subtitle ? (
            <p className="mt-3 text-sm leading-relaxed text-[var(--muted)] sm:text-base">
              {how.subtitle}
            </p>
          ) : null}
        </div>

        <ol className="mt-12 grid gap-6 sm:grid-cols-3">
          {how.steps.map((step, i) => (
            <li
              key={`${step.title}-${i}`}
              className={`animate-fade-up stagger-${Math.min(i + 1, 6)} relative rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6`}
            >
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--primary)] text-sm font-bold text-[var(--primary-foreground)]">
                {i + 1}
              </span>
              <h3 className="mt-4 text-base font-semibold text-[var(--foreground)]">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
                {step.description}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
