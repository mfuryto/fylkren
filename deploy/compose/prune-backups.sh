#!/bin/sh
set -eu

if [ "$#" -ne 2 ]; then
    echo "Usage: $0 /absolute/backup/directory MAXIMUM_COMPLETE_SETS" >&2
    exit 2
fi

backup_root=$1
maximum_sets=$2
case "$backup_root" in
    /*) ;;
    *) echo "Backup directory must be an absolute path." >&2; exit 2 ;;
esac
case "$maximum_sets" in
    ''|*[!0-9]*) echo "Maximum complete sets must be a non-negative integer." >&2; exit 2 ;;
esac
if [ "$maximum_sets" -gt 364 ]; then
    echo "Maximum complete sets cannot exceed 364." >&2
    exit 2
fi

[ -d "$backup_root" ] || exit 0

complete_sets=$(
    for candidate in "$backup_root"/fylkren-????????T??????Z; do
        [ -d "$candidate" ] || continue
        [ ! -L "$candidate" ] || continue
        name=${candidate##*/}
        printf '%s\n' "$name" | grep -Eq '^fylkren-[0-9]{8}T[0-9]{6}Z$' || continue
        [ -f "$candidate/COMPLETE" ] || continue
        [ ! -e "$candidate/INCOMPLETE" ] || continue
        printf '%s\n' "$name"
    done | sort
)

if [ -z "$complete_sets" ]; then
    exit 0
fi

complete_count=$(printf '%s\n' "$complete_sets" | wc -l | tr -d ' ')
delete_count=$((complete_count - maximum_sets))
if [ "$delete_count" -le 0 ]; then
    exit 0
fi

echo "Removing $delete_count old local Fylkren backup set(s); retaining at most $maximum_sets existing set(s)."
printf '%s\n' "$complete_sets" | sed -n "1,${delete_count}p" | while IFS= read -r name; do
    printf '%s\n' "$name" | grep -Eq '^fylkren-[0-9]{8}T[0-9]{6}Z$' || exit 1
    candidate="$backup_root/$name"
    [ -d "$candidate" ] && [ ! -L "$candidate" ] && \
        [ -f "$candidate/COMPLETE" ] && [ ! -e "$candidate/INCOMPLETE" ] || exit 1
    rm -rf -- "$candidate"
    echo "Removed old local backup: $candidate"
done
