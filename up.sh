#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
docker compose -f "$script_dir/ai-job-hunting-server/src/main/resources/docker/docker-compose.yml" up -d --build

docker image prune --force \
    --filter label=com.docker.compose.project=ai-job \
    --filter label=com.docker.compose.service=ai-job
