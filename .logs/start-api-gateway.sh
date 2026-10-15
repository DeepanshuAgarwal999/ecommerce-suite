#!/usr/bin/env bash
cd /e/ecommerce
set -a
source .env
set +a
export SERVICE_NAME=api-gateway
export PORT=3000
exec node dist/apps/api-gateway/main.js
