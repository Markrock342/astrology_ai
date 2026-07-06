import { handle, ok } from "@/lib/http";
import { getPublishedFaqItems } from "@/server/settings/settings-service";

/** GET /api/faq — published FAQ items for help center. */
export async function GET() {
  return handle(async () => ok(await getPublishedFaqItems()));
}
