/**
 * Remounts on route change so the content area fades in (ChatGPT-like handoff).
 * Query-only changes on the same page share this template instance.
 */
export default function AppTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="page-enter flex min-h-0 flex-1 flex-col">{children}</div>;
}
