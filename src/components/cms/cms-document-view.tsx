import { SimpleMarkdown } from "@/components/cms/simple-markdown";
import type { CmsDocument } from "@/lib/cms-keys";

/** Renders a CMS document (privacy, terms) from app_settings. */
export function CmsDocumentView({
  doc,
  backHref = "/login",
  backLabel = "← กลับไปหน้าเข้าสู่ระบบ",
}: {
  doc: CmsDocument;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <>
      <h1 className="text-2xl font-semibold text-[var(--foreground)]">{doc.title}</h1>
      <p className="mt-2 text-xs text-[var(--muted-2)]">
        ปรับปรุงล่าสุด: {doc.lastUpdated}
      </p>
      {doc.intro.startsWith("⚠️") ? (
        <div className="mt-4 rounded-xl border border-[var(--primary)]/30 bg-[var(--surface-2)] p-4">
          <p className="text-sm font-medium text-[var(--primary)]">
            <SimpleMarkdown text={doc.intro} />
          </p>
        </div>
      ) : (
        <p className="mt-4 text-sm leading-relaxed text-[var(--muted)]">
          <SimpleMarkdown text={doc.intro} />
        </p>
      )}

      <div className="mt-8 flex flex-col gap-8">
        {doc.sections.map((section) => (
          <section key={section.heading}>
            <h2 className="text-base font-semibold text-[var(--foreground)]">
              {section.heading}
            </h2>
            <ul className="mt-3 flex list-disc flex-col gap-2 pl-5">
              {section.body.map((line, i) => (
                <li key={i} className="text-sm leading-relaxed text-[var(--muted)]">
                  <SimpleMarkdown text={line} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {doc.footer && (
        <p className="mt-10 text-xs text-[var(--muted-2)]">{doc.footer}</p>
      )}
      <a
        href={backHref}
        className="mt-8 inline-block text-sm text-[var(--primary)] hover:underline"
      >
        {backLabel}
      </a>
    </>
  );
}
