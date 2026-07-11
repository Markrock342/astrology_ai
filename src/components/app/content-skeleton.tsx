/**
 * Instant navigation fallback for the authenticated content area. Rendered by
 * route-level `loading.tsx` files so page changes show immediate feedback while
 * the dynamic (auth + DB) server render streams in, instead of freezing on the
 * previous screen.
 */
export function ContentSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-6 md:p-10" aria-busy="true">
      <div className="h-8 w-52 animate-pulse rounded-lg bg-[var(--surface-2)]" />
      <div className="h-4 w-72 animate-pulse rounded bg-[var(--surface-2)]" />
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="h-40 animate-pulse rounded-2xl bg-[var(--surface-2)]" />
        <div className="h-40 animate-pulse rounded-2xl bg-[var(--surface-2)]" />
      </div>
      <div className="h-28 animate-pulse rounded-2xl bg-[var(--surface-2)]" />
    </div>
  );
}
