import { handle, ok } from "@/lib/http";
import { getPublicSettings } from "@/server/settings/settings-service";

/** GET /api/settings/public — CMS content for legal pages, consents, payment info. */
export async function GET() {
  return handle(async () => ok(await getPublicSettings()));
}
