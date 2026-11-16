#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
down_args=(down --rmi all --remove-orphans)

for arg in "$@"; do
    case "$arg" in
        --volumes|-v)
            down_args+=(--volumes)
            ;;
        --help|-h)
            echo "Usage: $0 [--volumes|-v]"
            echo "Remove this project's containers, network and service images; keep database data by default."
            echo "  --volumes, -v  Also delete database volumes and all stored data."
            exit 0
            ;;
        *)
            echo "Unknown option: $arg (use --help for usage)" >&2
            exit 2
            ;;
    esac
done

docker compose -f "$script_dir/ai-job-hunting-server/src/main/resources/docker/docker-compose.yml" "${down_args[@]}"
