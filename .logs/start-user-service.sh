#!/usr/bin/env bash
cd /e/ecommerce
set -a
source .env
set +a
export DATABASE_URL="$USER_SERVICE_DATABASE_URL"
export SERVICE_NAME=user-service
export PORT=3002
export TCP_PORT=4002
exec node dist/apps/user-service/main.js
