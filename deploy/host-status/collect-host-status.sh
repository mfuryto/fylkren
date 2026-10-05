#!/bin/sh
set -eu

project_dir=${1:-$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)}
compose_project=${2:-}
runtime_dir="$project_dir/runtime"
status_file="$runtime_dir/host-status.json"
temporary_file="$runtime_dir/.host-status.$$.tmp"

mkdir -p "$runtime_dir"
umask 022
trap 'rm -f "$temporary_file"' EXIT HUP INT TERM

collected_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
hostname_value=$(hostname 2>/dev/null | tr -cd 'A-Za-z0-9._-' | cut -c1-255)
platform_value=$(uname -srm 2>/dev/null | tr -cd 'A-Za-z0-9._ /()-' | cut -c1-80)
[ -n "$hostname_value" ] || hostname_value=unknown
[ -n "$platform_value" ] || platform_value=unknown

set -- $(df -Pk "$project_dir" | awk 'NR == 2 { printf "%.0f %.0f", $2 * 1024, $4 * 1024 }')
disk_total=${1:-0}
disk_available=${2:-0}

last_backup=null
if [ -f "$runtime_dir/last-backup.timestamp" ]; then
    candidate=$(sed -n '1p' "$runtime_dir/last-backup.timestamp" | tr -d '\r')
    case "$candidate" in
        ????-??-??T??:??:??Z) last_backup="\"$candidate\"" ;;
    esac
fi

time_synchronized=false
time_status=unknown
time_source=unavailable
time_offset_milliseconds=null
time_maximum_offset_milliseconds=1000
time_detail="Host time synchronization could not be verified."
if command -v timedatectl >/dev/null 2>&1; then
    synchronized=$(LC_ALL=C timedatectl show --property=NTPSynchronized --value 2>/dev/null || true)
    if [ "$synchronized" = yes ]; then
        time_synchronized=true
        time_status=degraded
        time_source=$(LC_ALL=C timedatectl show-timesync --property=ServerName --value 2>/dev/null | tr -cd 'A-Za-z0-9._:-' | cut -c1-100 || true)
        [ -n "$time_source" ] || time_source=systemd-timesyncd
        raw_offset=$(LC_ALL=C timedatectl timesync-status --no-pager 2>/dev/null | awk '$1 == "Offset:" { print $2; exit }' || true)
        case "$raw_offset" in
            *ms) time_offset_milliseconds=$(printf '%s\n' "${raw_offset%ms}" | awk '{ printf "%.6f", $1 }') ;;
            *us) time_offset_milliseconds=$(printf '%s\n' "${raw_offset%us}" | awk '{ printf "%.6f", $1 / 1000 }') ;;
            *s) time_offset_milliseconds=$(printf '%s\n' "${raw_offset%s}" | awk '{ printf "%.6f", $1 * 1000 }') ;;
        esac
        if [ "$time_offset_milliseconds" != null ]; then
            if awk -v value="$time_offset_milliseconds" -v maximum="$time_maximum_offset_milliseconds" 'BEGIN { if (value < 0) value = -value; exit !(value <= maximum) }'; then
                time_status=healthy
                time_detail="Host clock is synchronized and within the configured offset boundary."
            else
                time_status=down
                time_detail="Host clock offset exceeds the configured boundary."
            fi
        else
            time_detail="Host reports synchronization, but the current offset is unavailable."
        fi
    elif [ "$synchronized" = no ]; then
        time_status=down
        time_source=systemd
        time_detail="Host clock is not synchronized."
    fi
fi

service_json=""
compose_ps_id() {
    if [ -n "$compose_project" ]; then
        docker compose -p "$compose_project" -f "$project_dir/compose.yaml" --project-directory "$project_dir" ps -q "$1"
    else
        docker compose -f "$project_dir/compose.yaml" --project-directory "$project_dir" ps -q "$1"
    fi
}
collect_service() {
    service_key=$1
    service_name=$2
    container_id=$(compose_ps_id "$service_key" 2>/dev/null || true)
    status=down
    detail="The container is not running."
    restarts=0
    if [ -n "$container_id" ]; then
        state=$(docker inspect --format '{{.State.Status}}' "$container_id" 2>/dev/null || printf unknown)
        health=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$container_id" 2>/dev/null || printf unknown)
        restarts=$(docker inspect --format '{{.RestartCount}}' "$container_id" 2>/dev/null || printf 0)
        case "$restarts" in *[!0-9]*|'') restarts=0 ;; esac
        if [ "$state" = running ] && { [ "$health" = healthy ] || [ "$health" = none ]; }; then
            status=healthy
            detail="The container is running."
        elif [ "$state" = running ] && [ "$health" = starting ]; then
            status=degraded
            detail="The container is starting and is not ready yet."
        elif [ "$state" = running ]; then
            status=down
            detail="The container is running, but its health check is failing."
        else
        detail="Container status: $state."
        fi
    fi
    item="{\"key\":\"$service_key\",\"name\":\"$service_name\",\"status\":\"$status\",\"detail\":\"$detail\",\"restartCount\":$restarts}"
    if [ -n "$service_json" ]; then service_json="$service_json,$item"; else service_json=$item; fi
}

if command -v docker >/dev/null 2>&1; then
    collect_service web "Web-container"
    collect_service api "API-container"
    collect_service postgres "PostgreSQL-container"
else
    service_json='{"key":"docker","name":"Docker","status":"down","detail":"The Docker command is unavailable.","restartCount":0}'
fi

cat >"$temporary_file" <<EOF
{"schemaVersion":1,"collectedAt":"$collected_at","platform":"$platform_value","hostname":"$hostname_value","disk":{"name":"Fylkren-disk","totalBytes":$disk_total,"availableBytes":$disk_available},"backup":{"lastCompletedAt":$last_backup},"time":{"synchronized":$time_synchronized,"status":"$time_status","source":"$time_source","offsetMilliseconds":$time_offset_milliseconds,"maximumAllowedOffsetMilliseconds":$time_maximum_offset_milliseconds,"detail":"$time_detail"},"services":[$service_json]}
EOF
chmod 0644 "$temporary_file"
mv -f "$temporary_file" "$status_file"
trap - EXIT HUP INT TERM
