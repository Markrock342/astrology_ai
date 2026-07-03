import { handle, ok } from "@/lib/http";
import { listPublicCategories } from "@/server/horoscope/category-service";

/** Public-ish list of enabled categories (spec 5.5 dashboard uses this). */
export async function GET() {
  return handle(async () => ok(await listPublicCategories()));
}
