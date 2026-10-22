#!/usr/bin/env bash
# Builds and (re)starts the whole production stack on this server.
# Run from anywhere inside the repo, after `git pull`:   bash infra/deploy/deploy.sh
#
# Extra arguments go to `docker compose`, e.g.
#   bash infra/deploy/deploy.sh logs -f notification-service
#   bash infra/deploy/deploy.sh ps
set -euo pipefail

INFRA="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$INFRA/.env.prod"

if [ ! -f "$ENV_FILE" ]; then
  echo "missing $ENV_FILE - copy infra/.env.prod.example and fill it in" >&2
  exit 1
fi

compose() {
  docker compose --env-file "$ENV_FILE" \
    -f "$INFRA/docker-compose.yml" -f "$INFRA/docker-compose.prod.yml" \
    --profile app "$@"
}

if [ "$#" -gt 0 ]; then
  compose "$@"
  exit
fi

compose up -d --build --remove-orphans
docker image prune -f > /dev/null
compose ps
