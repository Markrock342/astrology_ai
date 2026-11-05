# Curated knowledge ownership

The knowledge library belongs to the team. Its content, publication state, category and order must not be overwritten or disabled by importing defaults. Both the knowledge part of `db:seed` and `knowledge:upsert` use `prisma/seed-knowledge-safe.ts`.

`npm run knowledge:upsert` previews without mutation. `npm run knowledge:upsert -- --apply` only initializes a completely empty library with no previous knowledge audit history or bootstrap marker. Existing documents (including disabled/edited defaults) are preserved. Intentionally deleted documents are not recreated. The marker prevents reinitialization even if someone subsequently removes the bootstrap documents. `db:seed` continues to provision other demo data; the ownership guarantee here applies to knowledge, not to all seed operations.

Opening the knowledge list is read-only. It no longer creates the engine formula guide. Existing copies of that guide remain available as a separate source intended for the team, not AI interpretation.

The admin list shows document source, explicit AI-reference status, available author/status-change evidence, and source/status filters. Only known default IDs are classified as defaults. A current state that contradicts the latest recorded state is marked unrecorded; the UI must not blame an earlier author for an unlogged change. Reference toggles require confirmation, and toggling a document updates an open editor's enabled value so publishing it does not reverse the toggle.

## 5 November 2026 recovery

Production evidence identified 25 authored documents disabled together at 18 October 2026 22:38 Bangkok time, alongside nine default records imported at the same instant. The old import script disabled other enabled globals/category documents and upserted defaults. Prior admin deletion events also existed for several defaults that the import recreated. The import did not record the executing user, so attribution of its runner is unknown.

An incident-specific, guarded recovery lives in `src/server/knowledge/knowledge-recovery.ts`. It requires an authorized Super Admin and a verified private pre-repair backup SHA-256. It checks the exact incident timestamps, authoring audits, previous enabled state, unchanged default templates and expected 25/9 plan. If any document changed since the incident it refuses the entire plan for review. Apply uses a serializable transaction with per-row version checks, changes only enabled flags, verifies content/draft hashes, appends 34 maintenance audit rows with reason/backup hash, and records an idempotency marker. The system guide remains disabled. No document is deleted.

Private before/after snapshots are stored on the VPS in `/root/horasard-repair-backups/knowledge-20261105-{before,after}.json` (directory 0700, files 0600). Comparison confirmed all 35 titles, contents, drafts, categories and sort orders were unchanged. Restore decisions must account for subsequent owner edits rather than blindly replaying old states.

Tests: `npm run ci`, `npm run test:integration:admin-users` and `npm run test:ui:knowledge`. The browser suite is part of the existing GitHub/Coolify admin gate and stores synthetic screenshots under `output/admin-ui-tests/knowledge-sources-*.png`.
