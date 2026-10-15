#!/usr/bin/env bash
cd /e/ecommerce
set -a
source .env
set +a
export DATABASE_URL="$PAYMENT_SERVICE_DATABASE_URL"
export SERVICE_NAME=payment-service
export PORT=3007
export TCP_PORT=4007
exec node dist/apps/payment-service/main.js
