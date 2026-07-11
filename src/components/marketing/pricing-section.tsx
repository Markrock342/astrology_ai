import Link from "next/link";
import type { CmsLandingPricingSection } from "@/lib/cms-keys";

export type MarketingPackage = {
  code: string;
  name: string;
  type: "FREE" | "PRO" | string;
  price: number;
  billingLabel: string | null;
  creditQuota: number;
  description: string | null;
  features: string[];
  upgradeSteps: string[];
};

function displayFeatures(pkg: MarketingPackage): string[] {
  if (pkg.features.length > 0) return pkg.features;
  if (pkg.type === "PRO") {
    return [
      `เครดิต ${pkg.creditQuota} ครั้ง`,
      "ปลดล็อกทุกหมวด + โหมดดวงจร",
      "คำถามแนะนำครบทุกหมวด",
    ];
  }
  return [
    `เครดิต ${pkg.creditQuota} ครั้ง`,
    "หมวดพื้นดวงเดิม (บางหมวด)",
    "ถาม–ตอบกับ AI",
  ];
}

export function PricingSection({
  section,
  packages,
  compact = false,
}: {
  section: CmsLandingPricingSection;
  packages: MarketingPackage[];
  compact?: boolean;
}) {
  if (!section.enabled || packages.length === 0) return null;

  return (
    <section
      className={`border-t border-[var(--border)] bg-[var(--surface)]/40 px-6 ${
        compact ? "py-16" : "py-20"
      }`}
    >
      <div className="mx-auto max-w-5xl">
        {(section.title || section.subtitle) && (
          <div className="mx-auto max-w-2xl text-center">
            {section.title ? (
              <h2 className="text-2xl font-semibold text-[var(--foreground)] sm:text-3xl">
                {section.title}
              </h2>
            ) : null}
            {section.subtitle ? (
              <p className="mt-3 text-sm leading-relaxed text-[var(--muted)] sm:text-base">
                {section.subtitle}
              </p>
            ) : null}
          </div>
        )}

        <div
          className={`mx-auto mt-12 grid gap-5 ${
            packages.length === 1
              ? "max-w-md"
              : packages.length === 2
                ? "max-w-3xl sm:grid-cols-2"
                : "sm:grid-cols-2 lg:grid-cols-3"
          }`}
        >
          {packages.map((pkg) => {
            const highlight = pkg.type === "PRO";
            const features = displayFeatures(pkg);
            return (
              <article
                key={pkg.code}
                className={`flex flex-col rounded-2xl border p-6 ${
                  highlight
                    ? "border-[var(--primary)]/55 bg-[var(--surface)] shadow-[0_0_0_1px_rgba(201,162,75,0.12)]"
                    : "border-[var(--border)] bg-[var(--surface)]"
                } ${compact ? "p-5" : "p-6"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-lg font-semibold text-[var(--foreground)]">
                    {pkg.name}
                  </h3>
                  {highlight ? (
                    <span className="rounded-full bg-[var(--primary)]/15 px-2.5 py-0.5 text-[11px] font-medium text-[var(--primary)]">
                      แนะนำ
                    </span>
                  ) : null}
                </div>
                {pkg.description && !compact ? (
                  <p className="mt-2 text-sm text-[var(--muted)]">{pkg.description}</p>
                ) : null}
                <p className="mt-4">
                  <span className="text-3xl font-semibold text-[var(--primary)]">
                    ฿{pkg.price.toLocaleString("th-TH")}
                  </span>
                  <span className="ml-1 text-xs text-[var(--muted-2)]">
                    / {pkg.billingLabel ?? "ต่อแพ็กเกจ"}
                  </span>
                </p>
                <ul className={`mt-5 space-y-2 text-sm text-[var(--muted)] ${compact ? "mt-4" : ""}`}>
                  {features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <CheckIcon />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-auto pt-6">
                  <Link
                    href="/login?tab=register"
                    className={`block rounded-full px-5 py-2.5 text-center text-sm font-semibold transition ${
                      highlight
                        ? "bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)]"
                        : "border border-[var(--border)] text-[var(--foreground)] hover:border-[var(--primary)]/40 hover:bg-[var(--surface-2)]"
                    }`}
                  >
                    {highlight ? "อัปเกรด Pro" : "เริ่มฟรี"}
                  </Link>
                </div>
              </article>
            );
          })}
        </div>

        {compact ? (
          <p className="mt-8 text-center">
            <Link
              href="/pricing"
              className="text-sm font-medium text-[var(--primary)] underline-offset-2 hover:underline"
            >
              ดูรายละเอียดแพ็กเกจทั้งหมด →
            </Link>
          </p>
        ) : null}
      </div>
    </section>
  );
}

function CheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      className="mt-0.5 shrink-0 text-[var(--secondary-active)]"
      aria-hidden
    >
      <path
        d="M5 12l5 5 9-11"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
