#!/bin/sh
set -eu

confirmation=--confirm-destructive-restore
if [ "$#" -ne 2 ] || [ "$2" != "$confirmation" ]; then
    echo "Usage: sudo $0 /absolute/path/to/fylkren-TIMESTAMP $confirmation" >&2
    echo "This permanently replaces the current database, configuration and Data Protection keys." >&2
    exit 2
fi

backup_set=${1%/}
case "$backup_set" in
    /*) ;;
    *) echo "Backup set path must be absolute." >&2; exit 2 ;;
esac

for artifact in fylkren.dump env.backup data-protection-keys.tar.gz manifest.json SHA256SUMS COMPLETE; do
    if [ ! -f "$backup_set/$artifact" ] || [ ! -s "$backup_set/$artifact" ]; then
        echo "Required backup artifact is missing or empty: $backup_set/$artifact" >&2
        exit 1
    fi
done
if [ -e "$backup_set/INCOMPLETE" ]; then
    echo "Refusing to restore a backup set marked INCOMPLETE." >&2
    exit 1
fi
(cd "$backup_set" && sha256sum -c SHA256SUMS)
if tar -tzf "$backup_set/data-protection-keys.tar.gz" | grep -Ev '^(\./|\./[A-Za-z0-9._-]+)$' | grep -q .; then
    echo "The Data Protection key archive contains an unsafe path." >&2
    exit 1
fi
tar -tzf "$backup_set/data-protection-keys.tar.gz" | grep -Eq '^\./[A-Za-z0-9._-]+$' || {
    echo "The Data Protection key archive contains no key files." >&2
    exit 1
}

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
project_dir=$(CDPATH= cd -- "$script_dir/../.." && pwd)
env_file="$project_dir/.env"

compose() {
    if [ -n "${FYLKREN_COMPOSE_PROJECT:-}" ]; then
        docker compose -p "$FYLKREN_COMPOSE_PROJECT" -f "$project_dir/compose.yaml" --project-directory "$project_dir" "$@"
    else
        docker compose -f "$project_dir/compose.yaml" --project-directory "$project_dir" "$@"
    fi
}

command -v docker >/dev/null 2>&1 || { echo "Docker is not available." >&2; exit 1; }
compose create postgres api web >/dev/null
postgres_image=$(compose images -q postgres | sed -n '1p')
web_image=$(compose images -q web | sed -n '1p')
api_container=$(compose ps -q -a api)
if [ -z "$postgres_image" ] || [ -z "$web_image" ] || [ -z "$api_container" ]; then
    echo "The current Fylkren images and API container configuration must exist before restore." >&2
    exit 1
fi
api_user=$(docker inspect --format '{{.Config.User}}' "$api_container")
case "$api_user" in ''|*[!0-9]*) echo "The API data owner is invalid." >&2; exit 1 ;; esac
docker run --rm -i --network none --read-only --cap-drop ALL \
    --security-opt no-new-privileges:true --entrypoint pg_restore \
    "$postgres_image" --list <"$backup_set/fylkren.dump" >/dev/null

echo "Stopping Fylkren and replacing the configured restore point ..."
compose down
cp "$backup_set/env.backup" "$env_file"
chmod 0600 "$env_file"

compose create postgres api >/dev/null
postgres_container=$(compose ps -q -a postgres)
api_container=$(compose ps -q -a api)
database_volume=$(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/var/lib/postgresql"}}{{.Name}}{{end}}{{end}}' "$postgres_container")
key_volume=$(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/var/lib/fylkren/keys"}}{{.Name}}{{end}}{{end}}' "$api_container")
case "$database_volume:$key_volume" in
    *[!A-Za-z0-9_.:-]*|:*|*:) echo "Restore volumes could not be identified safely." >&2; exit 1 ;;
esac
if [ "$database_volume" = "$key_volume" ]; then
    echo "Database and key volumes unexpectedly resolve to the same volume." >&2
    exit 1
fi
compose down
docker volume rm "$database_volume" "$key_volume" >/dev/null

compose up -d --wait postgres
compose exec -T postgres pg_restore -U fylkren -d fylkren --exit-on-error --no-owner <"$backup_set/fylkren.dump"

compose create api >/dev/null
api_container=$(compose ps -q -a api)
key_volume=$(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/var/lib/fylkren/keys"}}{{.Name}}{{end}}{{end}}' "$api_container")
case "$key_volume" in ''|*[!A-Za-z0-9_.-]*) echo "Restored key volume is invalid." >&2; exit 1 ;; esac
docker run --rm -i --network none --read-only --cap-drop ALL \
    --security-opt no-new-privileges:true --user "$api_user" \
    --entrypoint tar --mount "type=volume,src=$key_volume,dst=/restore" \
    "$web_image" -xzf - -C /restore <"$backup_set/data-protection-keys.tar.gz"

compose up -d --wait
"$project_dir/deploy/host-status/collect-host-status.sh" \
    "$project_dir" "${FYLKREN_COMPOSE_PROJECT:-}"
echo "Restore completed from: $backup_set"
echo "Verify login, protected settings and the federation fingerprint before production traffic is enabled."
echo "If this is a replacement server, confirm that the original instance is stopped or fenced before enabling network traffic."
