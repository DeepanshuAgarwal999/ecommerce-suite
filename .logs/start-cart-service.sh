#!/usr/bin/env bash
cd /e/ecommerce
set -a
source .env
set +a
export DATABASE_URL="$CART_SERVICE_DATABASE_URL"
export SERVICE_NAME=cart-service
export PORT=3005
export TCP_PORT=4005
exec node dist/apps/cart-service/main.js
