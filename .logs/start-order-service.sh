#!/usr/bin/env bash
cd /e/ecommerce
set -a
source .env
set +a
export DATABASE_URL="$ORDER_SERVICE_DATABASE_URL"
export SERVICE_NAME=order-service
export PORT=3006
export TCP_PORT=4006
exec node dist/apps/order-service/main.js
