#!/bin/bash
# Creates one database per service on first boot of the Postgres container.
#
# Database-per-service is the boundary that keeps services independently deployable:
# no service can reach into another's tables, so a schema change in one never breaks
# another. They share a Postgres *instance* here purely to keep local dev light; in
# production each would typically be its own managed instance or at least its own
# PgBouncer pool.
set -e

DATABASES="auth_db user_db catalog_db inventory_db cart_db order_db payment_db notification_db"

for db in $DATABASES; do
  echo "[init] creating database $db"
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    SELECT 'CREATE DATABASE $db'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$db')\gexec
    GRANT ALL PRIVILEGES ON DATABASE $db TO $POSTGRES_USER;
EOSQL
done

# pg_trgm speeds up the ILIKE searches the catalogue uses; harmless elsewhere.
for db in $DATABASES; do
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$db" \
    -c 'CREATE EXTENSION IF NOT EXISTS pg_trgm;' \
    -c 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'
done

echo "[init] done"
