/**
 * Give back the usage paying Pro users lost on 1–2 Oct 2026 — see
 * src/server/admin/repair-pro-lapse-service.ts. On production, use the button
 * in Admin → ต้นทุน (the database is internal to the server); this script is
 * for a database you can reach.
 *
 *   npx tsx --env-file=.env --tsconfig tsconfig.json scripts/repair-pro-lapse.ts          # list only
 *   npx tsx --env-file=.env --tsconfig tsconfig.json scripts/repair-pro-lapse.ts --apply  # write
 */
import { prisma } from "@/server/db";
import { repairProLapse } from "@/server/admin/repair-pro-lapse-service";

const apply = process.argv.includes("--apply");
repairProLapse({ apply })
  .then((r) => {
    for (const row of r.rows) {
      console.log(
        `${apply ? "repaired" : "would repair"} user …${row.userId.slice(-6)}: ${row.before} → ${row.after} ` +
          `(lapse ${row.lapsedAt.slice(0, 10)}, Pro until ${row.proUntil?.slice(0, 10) ?? "no end"})`,
      );
    }
    console.log(`\n${apply ? "repaired" : "to repair"}: ${r.rows.length} · skipped: ${r.skipped} · lapses seen: ${r.lapsesSeen}`);
  })
  .finally(() => prisma.$disconnect());
