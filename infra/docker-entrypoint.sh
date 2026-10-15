#!/bin/sh
# Runs pending migrations before starting the service.
#
# `migrate deploy` is idempotent and safe to run from every replica: Prisma takes an
# advisory lock, so concurrent starters queue rather than race. Set RUN_MIGRATIONS=false
# to skip it (for example when a separate job owns migrations in Kubernetes).
set -e

if [ -f /app/prisma/schema.prisma ] && [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  if [ -d /app/prisma/migrations ]; then
    echo "[entrypoint] applying migrations for ${APP_NAME}"
    npx prisma migrate deploy --schema=/app/prisma/schema.prisma
  else
    # No migration history yet (fresh repo): push the schema directly. Replace with
    # `migrate deploy` once `prisma migrate dev` has produced a migrations folder.
    echo "[entrypoint] no migrations folder; running db push for ${APP_NAME}"
    npx prisma db push --schema=/app/prisma/schema.prisma --skip-generate --accept-data-loss
  fi
fi

exec "$@"
