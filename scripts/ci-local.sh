#!/usr/bin/env bash
# Thin wrapper — prefer `npm run ci` (node scripts/ci-local.mjs).
set -euo pipefail
cd "$(dirname "$0")/.."
exec node scripts/ci-local.mjs