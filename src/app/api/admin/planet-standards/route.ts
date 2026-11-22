import { handle, ok } from "@/lib/http";
import { AppError } from "@/lib/errors";
import { requireAdmin } from "@/server/auth/rbac";
import { clientIp } from "@/lib/rate-limit";
import { DEFAULT_PLANET_STANDARDS, formatPlanetStandardsForPrompt, validatePlanetStandards } from "@/lib/planet-standards";
import { getSavedPlanetStandards, savePlanetStandards } from "@/server/catalog/planet-standards-service";

/** GET /api/admin/planet-standards — the team's ตารางมาตรฐานดาว and what the AI reads from it. */
export async function GET() {
  return handle(async () => {
    await requireAdmin();
    const saved = await getSavedPlanetStandards();
    return ok({
      table: saved.table,
      defaults: DEFAULT_PLANET_STANDARDS,
      customised: saved.customised,
      updatedAt: saved.updatedAt?.toISOString() ?? null,
      promptPreview: formatPlanetStandardsForPrompt(saved.table).join("\n"),
    });
  });
}

/** PUT /api/admin/planet-standards — save the table (audited). Body {table} or {reset:true}. */
export async function PUT(req: Request) {
  return handle(async () => {
    const admin = await requireAdmin();
    const body = (await req.json()) as { table?: unknown; reset?: boolean };
    let table = null;
    if (!body.reset) {
      const result = validatePlanetStandards(body.table);
      if (!result.ok) throw new AppError("VALIDATION", result.error);
      table = result.table;
    }
    const saved = await savePlanetStandards(table, { id: admin.id, ip: clientIp(req) });
    return ok({ table: saved, customised: Boolean(table), promptPreview: formatPlanetStandardsForPrompt(saved).join("\n") });
  });
}
