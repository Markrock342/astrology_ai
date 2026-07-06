import type { CmsText } from "@/lib/cms-keys";

/** Renders a short CMS text block (disclaimer, consent snippets). */
export function CmsTextView({
  title,
  text,
  backHref = "/login",
  backLabel = "← กลับไปหน้าเข้าสู่ระบบ",
}: {
  title: string;
  text: CmsText;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <>
      <h1 className="text-2xl font-semibold text-[var(--foreground)]">{title}</h1>
      <p className="mt-6 text-sm leading-relaxed text-[var(--muted)]">{text.text}</p>
      <a
        href={backHref}
        className="mt-8 inline-block text-sm text-[var(--primary)] hover:underline"
      >
        {backLabel}
      </a>
    </>
  );
}
