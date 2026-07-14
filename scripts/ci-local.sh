#!/usr/bin/env bash
# Local stand-in for .github/workflows/ci.yml while GitHub Actions is unavailable
# (e.g. account billing lock). Same steps as the "check" job.
set -euo pipefail
cd "$(dirname "$0")/.."

export DATABASE_URL="${DATABASE_URL:-postgresql://ci:ci@localhost:5432/ci}"
export AUTH_SECRET="${AUTH_SECRET:-ci-placeholder-not-a-real-secret}"

echo "==> prisma generate"
npx prisma generate

echo "==> typecheck"
npx tsc --noEmit

echo "==> lint"
npx eslint src e2e

echo "==> unit tests"
npx vitest run

echo "==> CI check OK"
