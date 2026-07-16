#!/usr/bin/env node
/**
 * Refuse to auto-apply a migration that can destroy data or break the running
 * app mid-deploy. Rules live in migration-guard.ts and are unit-tested.
 */
import { checkMigrations } from "./migration-guard";

const offenders = checkMigrations();

if (offenders.length > 0) {
  console.error(
    "\n✗ This migration would be auto-applied to PRODUCTION and can destroy data\n" +
      "  or break the app that is still serving traffic while it runs:\n",
  );
  for (const { file, hits } of offenders) {
    console.error(`  ${file}`);
    for (const h of hits) console.error(`      ${h}`);
  }
  console.error(
    "\nIf this is intentional and you have checked it against live data, say so in\n" +
      "the migration file and it will be allowed through:\n\n" +
      "  -- ALLOW_DESTRUCTIVE: <why this is safe>\n",
  );
  process.exit(1);
}

console.log("✓ migrations are additive (or explicitly cleared)");
