#!/usr/bin/env bash
set -euo pipefail
export LC_ALL=C

for task in /init.d/*; do
    [[ -f "$task" ]] || continue
    case "$task" in
        *.sql)
            echo "Running initialization task: ${task##*/}"
            mysql --host="$MYSQL_HOST" --user="$MYSQL_USER" --database="$MYSQL_DATABASE" < "$task"
            ;;
        *.sh)
            echo "Running initialization task: ${task##*/}"
            bash "$task"
            ;;
    esac
done
