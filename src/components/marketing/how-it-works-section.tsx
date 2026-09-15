import type { CmsLandingHowItWorks } from "@/lib/cms-keys";
import { SectionHeader } from "@/components/marketing/section-header";

const THAI_DIGITS = ["๐", "๑", "๒", "๓", "๔", "๕", "๖", "๗", "๘", "๙"] as const;

function thaiNumeral(n: number): string {
  return String(n)
    .split("")
    .map((d) => THAI_DIGITS[Number(d)] ?? d)
    .join("");
}

/**
 * Desktop: one continuous gold rule with a Thai numeral sitting on it per
 * step. Mobile: stacked rows, numeral beside the text.
 */
export function HowItWorksSection({ how }: { how: CmsLandingHowItWorks }) {
  if (!how.steps?.length) return null;

  return (
    <section className="px-6 py-16 sm:py-20">
      <div className="mx-auto max-w-5xl">
        <SectionHeader title={how.title} subtitle={how.subtitle} />

        <ol className="relative mt-12 sm:grid sm:grid-cols-3 sm:gap-x-10">
          <span
            aria-hidden
            className="absolute inset-x-0 top-4 hidden h-px bg-[var(--primary)]/25 sm:block"
          />
          {how.steps.map((step, i) => (
            <li
              key={`${step.title}-${i}`}
              className={`animate-fade-up stagger-${Math.min(i + 1, 6)} relative flex gap-5 border-t border-[var(--primary)]/25 py-6 first:border-t-0 sm:block sm:border-t-0 sm:py-0`}
            >
              <span
                className="relative shrink-0 text-2xl font-light leading-8 text-[var(--primary)] sm:inline-block sm:bg-[var(--background)] sm:pr-3"
                aria-hidden
              >
                {thaiNumeral(i + 1)}
              </span>
              <div className="sm:mt-5">
                <h3 className="text-base font-semibold text-[var(--foreground)]">
                  <span className="sr-only">ขั้นตอนที่ {i + 1}: </span>
                  {step.title}
                </h3>
                <p className="mt-2 max-w-[65ch] text-sm leading-relaxed text-[var(--muted)]">
                  {step.description}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
