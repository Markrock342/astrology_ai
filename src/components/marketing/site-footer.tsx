import Link from "next/link";
import { BrandMark } from "@/components/brand-logo";
import type { CmsSiteFooter } from "@/lib/cms-keys";

export function SiteFooter({ footer }: { footer: CmsSiteFooter }) {
  return (
    <footer className="mt-auto border-t border-[var(--border)] bg-[var(--surface)]">
      <div className="mx-auto grid max-w-5xl gap-10 px-6 py-12 sm:grid-cols-[1.2fr_1fr]">
        <div>
          <div className="flex items-center gap-3">
            <BrandMark size={36} />
            <span className="text-lg font-semibold text-[var(--primary)]">โหราศาสตร์</span>
          </div>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-[var(--muted)]">
            {footer.brandBlurb}
          </p>
        </div>

        <div className="grid gap-8 sm:grid-cols-2">
          {footer.links.length > 0 && (
            <nav aria-label="ลิงก์ส่วนท้าย">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-2)]">
                เมนู
              </p>
              <ul className="mt-3 space-y-2">
                {footer.links.map((link) => (
                  <li key={`${link.href}-${link.label}`}>
                    <Link
                      href={link.href}
                      className="text-sm text-[var(--muted)] transition hover:text-[var(--primary)]"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          {footer.socialLinks.length > 0 && (
            <nav aria-label="โซเชียล">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-2)]">
                ติดตาม
              </p>
              <ul className="mt-3 space-y-2">
                {footer.socialLinks.map((link) => (
                  <li key={`${link.href}-${link.label}`}>
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-[var(--muted)] transition hover:text-[var(--primary)]"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </div>
      </div>

      <div className="border-t border-[var(--border)] px-6 py-4 text-center text-xs text-[var(--muted-2)]">
        {footer.copyright}
      </div>
    </footer>
  );
}
