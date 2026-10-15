#!/usr/bin/env bash
cd /e/ecommerce
set -a
source .env
set +a
export DATABASE_URL="$RECOMMENDATION_SERVICE_DATABASE_URL"
export SERVICE_NAME=recommendation-service
export PORT=3009
export TCP_PORT=4009
exec node dist/apps/recommendation-service/main.js
