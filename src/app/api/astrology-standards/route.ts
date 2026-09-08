import { handle, ok } from "@/lib/http";
import { DEFAULT_STANDARD_GLOSSARY } from "@/lib/astrology-standard-glossary";
import {
  listPublishedAstrologyStandards,
  seedDefaultAstrologyStandardsIfEmpty,
} from "@/server/admin/astrology-standard-admin-service";

/** GET /api/astrology-standards — public copy for natal standard cards. */
export async function GET() {
  return handle(async () => {
    try {
      await seedDefaultAstrologyStandardsIfEmpty();
      const rows = await listPublishedAstrologyStandards();
      if (rows.length) return ok(rows);
    } catch (err) {
      console.warn(
        "[astrology-standards] falling back to built-in glossary",
        err instanceof Error ? err.message : err,
      );
    }
    return ok(DEFAULT_STANDARD_GLOSSARY);
  });
}
