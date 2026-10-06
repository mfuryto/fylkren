#!/bin/sh
set -eu

project_dir=${1:-$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)}
compose_project=${2:-}
maximum_skew_seconds=${FYLKREN_MAXIMUM_CLOCK_SKEW_SECONDS:-2}
case "$maximum_skew_seconds" in ''|*[!0-9]*) echo "Clock skew boundary must be an integer." >&2; exit 2 ;; esac

compose() {
    if [ -n "$compose_project" ]; then
        docker compose -p "$compose_project" -f "$project_dir/compose.yaml" --project-directory "$project_dir" "$@"
    else
        docker compose -f "$project_dir/compose.yaml" --project-directory "$project_dir" "$@"
    fi
}

status_file="$project_dir/runtime/host-status.json"
"$project_dir/deploy/host-status/collect-host-status.sh" "$project_dir" "$compose_project" >/dev/null
grep -Eq '"time":\{"synchronized":true,"status":"healthy"' "$status_file" || {
    echo "Host NTP status is not healthy." >&2
    exit 1
}

host_epoch=$(date -u +%s)
minimum=$host_epoch
maximum=$host_epoch
observed="host=$host_epoch"
for service in web api postgres; do
    container=$(compose ps -q "$service")
    [ -n "$container" ] || { echo "$service is not running." >&2; exit 1; }
    if [ "$service" = postgres ]; then
        epoch=$(compose exec -T postgres psql -At -U fylkren -d fylkren -c "select floor(extract(epoch from clock_timestamp()))::bigint")
    else
        epoch=$(docker exec "$container" date -u +%s)
    fi
    case "$epoch" in ''|*[!0-9]*) echo "Invalid UTC timestamp from $service." >&2; exit 1 ;; esac
    [ "$epoch" -lt "$minimum" ] && minimum=$epoch
    [ "$epoch" -gt "$maximum" ] && maximum=$epoch
    observed="$observed $service=$epoch"
done
skew=$((maximum - minimum))
[ "$skew" -le "$maximum_skew_seconds" ] || {
    echo "Clock correlation exceeded ${maximum_skew_seconds}s: $observed" >&2
    exit 1
}
printf '{"timeCorrelation":"passed","maximumObservedSkewSeconds":%s,"boundarySeconds":%s,"timestamps":"%s"}\n' \
    "$skew" "$maximum_skew_seconds" "$observed"
