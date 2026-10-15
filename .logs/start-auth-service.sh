#!/usr/bin/env bash
cd /e/ecommerce
set -a
source .env
set +a
export DATABASE_URL="$AUTH_SERVICE_DATABASE_URL"
export SERVICE_NAME=auth-service
export PORT=3001
export TCP_PORT=4001
exec node dist/apps/auth-service/main.js
