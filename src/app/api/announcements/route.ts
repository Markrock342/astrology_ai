import { handle, ok } from "@/lib/http";
import { getActiveAnnouncements } from "@/server/settings/settings-service";

/** GET /api/announcements — active site banners for public UI. */
export async function GET() {
  return handle(async () => {
    const rows = await getActiveAnnouncements();
    return ok(
      rows.map((r) => ({
        id: r.id,
        title: r.title,
        message: r.message,
        tone: r.tone,
        linkUrl: r.linkUrl,
        linkLabel: r.linkLabel,
      })),
    );
  });
}
