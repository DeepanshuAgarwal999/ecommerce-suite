#!/usr/bin/env bash
cd /e/ecommerce
set -a
source .env
set +a
export DATABASE_URL="$SUPPORT_SERVICE_DATABASE_URL"
export SERVICE_NAME=support-service
export PORT=3010
export TCP_PORT=4010
exec node dist/apps/support-service/main.js
