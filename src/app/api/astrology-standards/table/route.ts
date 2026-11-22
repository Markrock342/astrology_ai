import { handle, ok } from "@/lib/http";
import { ensurePlanetStandardsLoaded } from "@/server/catalog/planet-standards-service";

/** GET /api/astrology-standards/table — the ตารางมาตรฐานดาว the chart table on the page computes with. */
export async function GET() {
  return handle(async () => ok(await ensurePlanetStandardsLoaded(), { headers: { "Cache-Control": "public, max-age=60" } }));
}
