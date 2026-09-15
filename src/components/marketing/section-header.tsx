/**
 * Landing section header. `align="split"` puts the title left and the
 * subtitle in a right-hand column (stacks on mobile); `align="left"` keeps
 * both in one left-aligned column; `align="center"` is reserved for the one
 * boxed section (pricing) and empty states.
 */
export function SectionHeader({
  title,
  subtitle,
  align = "split",
}: {
  title: string;
  subtitle?: string;
  align?: "split" | "left" | "center";
}) {
  const heading = (
    <h2 className="text-3xl font-normal leading-tight tracking-tight text-[var(--foreground)]">
      {title}
    </h2>
  );
  const sub = subtitle ? (
    <p className="max-w-[45ch] text-sm leading-relaxed text-[var(--muted)] sm:text-base">
      {subtitle}
    </p>
  ) : null;

  if (align === "center") {
    return (
      <div className="mx-auto max-w-2xl text-center">
        {heading}
        {sub ? <div className="mx-auto mt-3 flex justify-center">{sub}</div> : null}
      </div>
    );
  }

  if (align === "left") {
    return (
      <div className="max-w-2xl">
        {heading}
        {sub ? <div className="mt-3">{sub}</div> : null}
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 sm:items-end sm:gap-10">
      {heading}
      {sub ? <div className="sm:justify-self-end">{sub}</div> : null}
    </div>
  );
}
