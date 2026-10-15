#!/usr/bin/env bash
cd /e/ecommerce
set -a
source .env
set +a
export DATABASE_URL="$INVENTORY_SERVICE_DATABASE_URL"
export SERVICE_NAME=inventory-service
export PORT=3004
export TCP_PORT=4004
exec node dist/apps/inventory-service/main.js
