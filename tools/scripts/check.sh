#!/usr/bin/env bash
# Regenerate Prisma clients, then typecheck the whole workspace.
#
# The clients live under node_modules/@ecom-db/* (one per service database). Any `npm
# install` prunes them as extraneous, so `db:generate` is wired into postinstall and
# re-run here before typechecking.
set -e
cd "$(dirname "$0")/../.."
if [ "$(ls node_modules/@ecom-db 2>/dev/null | wc -l)" -lt 8 ]; then
  echo "[check] regenerating Prisma clients..."
  DATABASE_URL="${DATABASE_URL:-postgresql://u:p@localhost:5432/db}" node tools/scripts/prisma.mjs generate > /dev/null 2>&1
fi
npx tsc -p tsconfig.check.json
