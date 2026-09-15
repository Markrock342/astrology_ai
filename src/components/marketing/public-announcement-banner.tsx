import Link from "next/link";

type AnnouncementTone = "INFO" | "WARNING" | "PROMO" | "DANGER";

export type PublicAnnouncement = {
  id: string;
  title: string;
  message: string;
  tone: AnnouncementTone | string;
  linkUrl?: string | null;
  linkLabel?: string | null;
};

const TONE_CLASS: Record<AnnouncementTone, string> = {
  INFO: "border-[var(--border-strong)] bg-[var(--surface-2)] text-[var(--foreground)]",
  WARNING: "border-[var(--primary)]/45 bg-[var(--primary)]/12 text-[var(--foreground)]",
  PROMO:
    "border-[var(--secondary-active)]/40 bg-[var(--secondary-active)]/10 text-[var(--foreground)]",
  DANGER: "border-[var(--danger)]/45 bg-[var(--danger)]/10 text-[var(--foreground)]",
};

/** Server-rendered public announcements (same shape as in-app banners). */
export function PublicAnnouncementBanner({
  announcements,
}: {
  announcements: PublicAnnouncement[];
}) {
  if (announcements.length === 0) return null;

  return (
    <div className="flex flex-col gap-1 border-b border-[var(--border)] px-4 py-2">
      {announcements.map((item) => {
        const tone =
          (item.tone as AnnouncementTone) in TONE_CLASS
            ? (item.tone as AnnouncementTone)
            : "INFO";
        return (
          <div
            key={item.id}
            className={`flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-3 py-2 text-xs ${TONE_CLASS[tone]}`}
          >
            <div>
              <span className="font-medium">{item.title}</span>
              <span className="mx-2 opacity-40">·</span>
              <span>{item.message}</span>
            </div>
            {item.linkUrl ? (
              <Link
                href={item.linkUrl}
                className="shrink-0 underline-offset-2 hover:underline"
              >
                {item.linkLabel ?? "ดูรายละเอียด"}
              </Link>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
