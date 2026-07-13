#!/usr/bin/env bash
set -euo pipefail

PROJECT_NAME="${COMPOSE_PROJECT_NAME:-event-stream-filter}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
LEGACY_PROJECT_NAME="${LEGACY_PROJECT_NAME:-gratheon}"
SERVICE_NAME="${SERVICE_NAME:-event-stream-filter}"

cd "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"

stop_legacy_gratheon_service_container() {
  docker ps -aq \
    --filter "label=com.docker.compose.project=${LEGACY_PROJECT_NAME}" \
    --filter "label=com.docker.compose.service=${SERVICE_NAME}" \
    | while IFS= read -r container_id; do
        [ -n "$container_id" ] || continue
        docker rm -f "$container_id" >/dev/null 2>&1 || true
      done
}

if id www >/dev/null 2>&1; then
  sudo -H -u www bash -c "cd '$(pwd)'"
fi

stop_legacy_gratheon_service_container
COMPOSE_PROJECT_NAME="$PROJECT_NAME" docker-compose -f "$COMPOSE_FILE" down
COMPOSE_PROJECT_NAME="$PROJECT_NAME" docker-compose -f "$COMPOSE_FILE" up -d --build
