import { handle, ok } from "@/lib/http";
import { getThailandGeo } from "@/server/geo/thailand-geo-service";

/** GET /api/geo/thailand — countries, provinces, and province→district map for birth forms. */
export async function GET() {
  return handle(async () => ok(getThailandGeo()));
}
