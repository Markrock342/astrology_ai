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

/** Chat thread loading placeholder (user + assistant bubbles). */
export function ChatThreadSkeleton() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6" aria-busy="true">
      <div className="flex justify-end">
        <div className="h-10 w-48 animate-pulse rounded-2xl bg-[var(--surface-3)]" />
      </div>
      <div className="h-24 w-[85%] animate-pulse rounded-xl bg-[var(--surface-2)]" />
      <div className="flex justify-end">
        <div className="h-10 w-56 animate-pulse rounded-2xl bg-[var(--surface-3)]" />
      </div>
      <div className="h-32 w-[85%] animate-pulse rounded-xl bg-[var(--surface-2)]" />
    </div>
  );
}

/** Sidebar nav placeholder while bootstrap loads (avoids mock Free categories). */
export function SidebarNavSkeleton() {
  return (
    <div className="flex flex-col gap-3 px-3" aria-busy="true">
      <div className="h-10 animate-pulse rounded-full bg-[var(--surface-2)]" />
      <div className="h-9 animate-pulse rounded-lg bg-[var(--surface-2)]" />
      {Array.from({ length: 7 }, (_, i) => (
        <div key={i} className="h-9 animate-pulse rounded-lg bg-[var(--surface-2)]" />
      ))}
      <div className="my-2 border-t border-[var(--border)]" />
      {Array.from({ length: 4 }, (_, i) => (
        <div key={`t-${i}`} className="h-8 animate-pulse rounded-lg bg-[var(--surface-2)]" />
      ))}
    </div>
  );
}

/** List rows for history / sidebar-style pages. */
export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2" aria-busy="true">
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="h-12 animate-pulse rounded-xl bg-[var(--surface-2)]"
        />
      ))}
    </div>
  );
}

/** Admin dashboard stat cards while fetching. */
export function AdminDashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-[var(--surface-2)]" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-48 animate-pulse rounded-2xl bg-[var(--surface-2)]" />
        <div className="h-48 animate-pulse rounded-2xl bg-[var(--surface-2)]" />
      </div>
    </div>
  );
}
