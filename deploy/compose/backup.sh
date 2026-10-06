#!/bin/sh
set -eu

if [ "$#" -gt 1 ]; then
    echo "Usage: sudo $0 [/absolute/backup/directory]" >&2
    exit 2
fi

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
project_dir=$(CDPATH= cd -- "$script_dir/../.." && pwd)
backup_root=${1:-"$project_dir/backups"}
env_file="$project_dir/.env"
timestamp=$(date -u +%Y%m%dT%H%M%SZ)
target="$backup_root/fylkren-$timestamp"

case "$backup_root" in
    /*) ;;
    *) echo "Backup directory must be an absolute path." >&2; exit 2 ;;
esac
case "$backup_root" in
    *','*) echo "Backup directory cannot contain a comma." >&2; exit 2 ;;
esac

if [ ! -f "$env_file" ] || [ ! -s "$env_file" ]; then
    echo "The Fylkren .env file is missing or empty: $env_file" >&2
    exit 1
fi
if ! command -v docker >/dev/null 2>&1; then
    echo "Docker is not available." >&2
    exit 1
fi

retention_count=${FYLKREN_LOCAL_BACKUP_RETENTION_COUNT:-}
if [ -z "$retention_count" ]; then
    retention_count=$(sed -n 's/^FYLKREN_LOCAL_BACKUP_RETENTION_COUNT=\([0-9][0-9]*\)$/\1/p' "$env_file" | tail -n 1)
fi
retention_count=${retention_count:-14}
case "$retention_count" in
    ''|*[!0-9]*) echo "FYLKREN_LOCAL_BACKUP_RETENTION_COUNT must be an integer from 2 to 365." >&2; exit 1 ;;
esac
if [ "$retention_count" -lt 2 ] || [ "$retention_count" -gt 365 ]; then
    echo "FYLKREN_LOCAL_BACKUP_RETENTION_COUNT must be from 2 to 365." >&2
    exit 1
fi

umask 077
mkdir -p -m 0700 "$backup_root"
chmod 0700 "$backup_root"

compose() {
    if [ -n "${FYLKREN_COMPOSE_PROJECT:-}" ]; then
        docker compose -p "$FYLKREN_COMPOSE_PROJECT" -f "$project_dir/compose.yaml" --project-directory "$project_dir" "$@"
    else
        docker compose -f "$project_dir/compose.yaml" --project-directory "$project_dir" "$@"
    fi
}

postgres_container=$(compose ps -q postgres)
api_container=$(compose ps -q api)
web_image=$(compose images -q web | sed -n '1p')
if [ -z "$postgres_container" ] || [ -z "$api_container" ] || [ -z "$web_image" ]; then
    echo "Fylkren web, API and PostgreSQL must be running before backup." >&2
    exit 1
fi

postgres_state=$(docker inspect --format '{{.State.Status}}' "$postgres_container")
api_state=$(docker inspect --format '{{.State.Status}}' "$api_container")
if [ "$postgres_state" != running ] || [ "$api_state" != running ]; then
    echo "Fylkren API and PostgreSQL must be running before backup." >&2
    exit 1
fi
api_user=$(docker inspect --format '{{.Config.User}}' "$api_container")
case "$api_user" in
    ''|*[!0-9]*)
        echo "The API container's numeric data owner could not be identified safely." >&2
        exit 1
        ;;
esac

maximum_existing_sets=$((retention_count - 1))
"$script_dir/prune-backups.sh" "$backup_root" "$maximum_existing_sets"
if [ -e "$target" ]; then
    echo "Backup target already exists: $target" >&2
    exit 1
fi
mkdir -m 0700 "$target"
printf 'Backup is incomplete. Do not restore from this directory.\n' >"$target/INCOMPLETE"

echo "Creating PostgreSQL backup ..."
compose exec -T postgres pg_dump -U fylkren -d fylkren -Fc >"$target/fylkren.dump"
test -s "$target/fylkren.dump"

echo "Copying protected installation configuration ..."
cp -p "$env_file" "$target/env.backup"
chmod 0600 "$target/env.backup"

key_volume=$(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/var/lib/fylkren/keys"}}{{.Name}}{{end}}{{end}}' "$api_container")
custody_volume=$(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/run/fylkren-data-protection"}}{{.Name}}{{end}}{{end}}' "$api_container")
case "$key_volume" in
    ''|*[!A-Za-z0-9_.-]*)
        echo "The Data Protection key volume could not be identified safely." >&2
        exit 1
        ;;
esac
case "$custody_volume" in
    ''|*[!A-Za-z0-9_.-]*)
        echo "The Data Protection custody volume could not be identified safely." >&2
        exit 1
        ;;
esac

echo "Archiving matching Data Protection keys ..."
docker run --rm --network none --read-only --cap-drop ALL \
    --security-opt no-new-privileges:true --user "$api_user" \
    --entrypoint tar \
    --mount "type=volume,src=$key_volume,dst=/source,readonly" \
    "$web_image" -czf - -C /source . >"$target/data-protection-keys.tar.gz"
chmod 0600 "$target/data-protection-keys.tar.gz"
test -s "$target/data-protection-keys.tar.gz"
tar -tzf "$target/data-protection-keys.tar.gz" | grep -Eq '(^|/)[^/]+$'

echo "Archiving matching Data Protection key-encryption custody ..."
docker run --rm --network none --read-only --cap-drop ALL \
    --security-opt no-new-privileges:true --user "$api_user" \
    --entrypoint tar \
    --mount "type=volume,src=$custody_volume,dst=/source,readonly" \
    "$web_image" -czf - -C /source . >"$target/data-protection-custody.tar.gz"
chmod 0600 "$target/data-protection-custody.tar.gz"
test -s "$target/data-protection-custody.tar.gz"
tar -tzf "$target/data-protection-custody.tar.gz" | grep -Eq '^\./data-protection\.(crt|key)$'

database_hash=$(sha256sum "$target/fylkren.dump" | awk '{print $1}')
environment_hash=$(sha256sum "$target/env.backup" | awk '{print $1}')
keys_hash=$(sha256sum "$target/data-protection-keys.tar.gz" | awk '{print $1}')
custody_hash=$(sha256sum "$target/data-protection-custody.tar.gz" | awk '{print $1}')
commit=$(git --git-dir="$project_dir/.git" --work-tree="$project_dir" rev-parse HEAD 2>/dev/null || \
    git --git-dir="$project_dir/.git-local" --work-tree="$project_dir" rev-parse HEAD 2>/dev/null || printf unknown)

cat >"$target/manifest.json" <<EOF
{"schemaVersion":2,"completedAt":"$(date -u +%Y-%m-%dT%H:%M:%SZ)","commit":"$commit","databaseSha256":"$database_hash","environmentSha256":"$environment_hash","dataProtectionKeysSha256":"$keys_hash","dataProtectionCustodySha256":"$custody_hash","restoreTested":false}
EOF
chmod 0600 "$target/manifest.json"
(cd "$target" && sha256sum fylkren.dump env.backup data-protection-keys.tar.gz data-protection-custody.tar.gz manifest.json >SHA256SUMS)
chmod 0600 "$target/SHA256SUMS"

printf 'Backup set completed successfully.\n' >"$target/COMPLETE"
rm -f "$target/INCOMPLETE"
"$project_dir/deploy/host-status/record-backup.sh" \
    "$target/fylkren.dump" "$target/env.backup" "$target/data-protection-keys.tar.gz" "$target/data-protection-custody.tar.gz"
"$project_dir/deploy/host-status/collect-host-status.sh" \
    "$project_dir" "${FYLKREN_COMPOSE_PROJECT:-}"

echo "Backup completed: $target"
echo "Copy this directory to approved off-host storage and perform a restore rehearsal."
