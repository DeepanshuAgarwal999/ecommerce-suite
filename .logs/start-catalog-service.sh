#!/usr/bin/env bash
cd /e/ecommerce
set -a
source .env
set +a
export DATABASE_URL="$CATALOG_SERVICE_DATABASE_URL"
export SERVICE_NAME=catalog-service
export PORT=3003
export TCP_PORT=4003
exec node dist/apps/catalog-service/main.js
