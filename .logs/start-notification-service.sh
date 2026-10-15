#!/usr/bin/env bash
cd /e/ecommerce
set -a
source .env
set +a
export DATABASE_URL="$NOTIFICATION_SERVICE_DATABASE_URL"
export SERVICE_NAME=notification-service
export PORT=3008
export TCP_PORT=4008
exec node dist/apps/notification-service/main.js
