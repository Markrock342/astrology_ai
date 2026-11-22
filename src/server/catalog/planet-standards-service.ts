import { prisma } from "@/server/db";
import { writeAudit } from "@/server/audit/audit-service";
import {
  DEFAULT_PLANET_STANDARDS,
  activePlanetStandards,
  applyPlanetStandards,
  parsePlanetStandards,
  type PlanetStandardsTable,
} from "@/lib/planet-standards";

/**
 * The saved ตารางมาตรฐานดาว (Admin → มาตรฐานดาว). Loaded into the shared
 * lookup that lordOfSign/dignityLabel read, so the chart table, house chains,
 * chart memory and the prompt all follow what the team saved.
 */
const KEY = "astrology.planetStandards.v1";
/** Another server instance's save reaches this one within a minute. */
const TTL_MS = 60_000;

let loadedAt = 0;
let inflight: Promise<PlanetStandardsTable> | null = null;

export async function getSavedPlanetStandards(): Promise<{ table: PlanetStandardsTable; customised: boolean; updatedAt: Date | null }> {
  const row = await prisma.appSetting.findUnique({ where: { key: KEY }, select: { valueJson: true, updatedAt: true } });
  return { table: row ? parsePlanetStandards(row.valueJson) : DEFAULT_PLANET_STANDARDS, customised: Boolean(row), updatedAt: row?.updatedAt ?? null };
}

/** Apply the saved table before reading a chart; cheap when fresh. Falls back to the defaults on error. */
export async function ensurePlanetStandardsLoaded(): Promise<PlanetStandardsTable> {
  if (Date.now() - loadedAt < TTL_MS && !inflight) {
    return activePlanetStandards();
  }
  inflight ??= getSavedPlanetStandards()
    .then(({ table }) => {
      applyPlanetStandards(table);
      loadedAt = Date.now();
      return table;
    })
    .catch((err) => {
      console.warn("[planet-standards] load failed, keeping the current table", err instanceof Error ? err.message : err);
      loadedAt = Date.now() - TTL_MS + 5_000; // retry in a few seconds
      return DEFAULT_PLANET_STANDARDS;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export async function savePlanetStandards(table: PlanetStandardsTable | null, actor: { id: string; ip?: string }) {
  const before = (await getSavedPlanetStandards()).table;
  await prisma.$transaction(async (tx) => {
    if (table) {
      await tx.appSetting.upsert({ where: { key: KEY }, create: { key: KEY, valueJson: table as object }, update: { valueJson: table as object } });
    } else {
      await tx.appSetting.deleteMany({ where: { key: KEY } });
    }
    await writeAudit(
      {
        adminUserId: actor.id,
        action: table ? "astrology.planet_standards.set" : "astrology.planet_standards.reset",
        entityType: "app_setting",
        entityId: KEY,
        before,
        after: table ?? DEFAULT_PLANET_STANDARDS,
        ipAddress: actor.ip,
      },
      tx,
    );
  });
  const now = table ?? DEFAULT_PLANET_STANDARDS;
  applyPlanetStandards(now);
  loadedAt = Date.now();
  return now;
}
