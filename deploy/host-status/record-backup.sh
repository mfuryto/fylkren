#!/bin/sh
set -eu

if [ "$#" -ne 4 ]; then
    echo "Usage: $0 DATABASE_DUMP ENV_BACKUP DATA_PROTECTION_KEY_ARCHIVE DATA_PROTECTION_CUSTODY_ARCHIVE" >&2
    exit 2
fi

for artifact in "$@"; do
    if [ ! -f "$artifact" ] || [ ! -s "$artifact" ]; then
        echo "Backup artifact is missing or empty: $artifact" >&2
        exit 1
    fi
done

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
project_dir=$(CDPATH= cd -- "$script_dir/../.." && pwd)
runtime_dir="$project_dir/runtime"
completed_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
temporary_timestamp="$runtime_dir/.last-backup.$$.timestamp"
temporary_record="$runtime_dir/.last-backup.$$.json"

mkdir -p "$runtime_dir"
umask 077
trap 'rm -f "$temporary_timestamp" "$temporary_record"' EXIT HUP INT TERM

database_hash=$(sha256sum "$1" | awk '{print $1}')
environment_hash=$(sha256sum "$2" | awk '{print $1}')
keys_hash=$(sha256sum "$3" | awk '{print $1}')
custody_hash=$(sha256sum "$4" | awk '{print $1}')
printf '%s\n' "$completed_at" >"$temporary_timestamp"
printf '{"schemaVersion":2,"completedAt":"%s","databaseSha256":"%s","environmentSha256":"%s","dataProtectionKeysSha256":"%s","dataProtectionCustodySha256":"%s","restoreTested":false}\n' \
    "$completed_at" "$database_hash" "$environment_hash" "$keys_hash" "$custody_hash" >"$temporary_record"
chmod 0644 "$temporary_timestamp"
chmod 0600 "$temporary_record"
mv -f "$temporary_timestamp" "$runtime_dir/last-backup.timestamp"
mv -f "$temporary_record" "$runtime_dir/last-backup.json"
trap - EXIT HUP INT TERM

echo "Recorded complete Fylkren backup set at $completed_at. A restore rehearsal is still required."
