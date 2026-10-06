#!/bin/sh
set -eu

project_dir=${1:-$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)}
compose_project=${2:-}
configuration=/etc/systemd/journal-upload.conf.d/fylkren.conf
state=/var/lib/systemd/journal-upload/state
[ "$(id -u)" -eq 0 ] || { echo "Run as root." >&2; exit 1; }
[ -s "$configuration" ] || { echo "Fylkren journal upload is not configured." >&2; exit 1; }
grep -Eq '^URL=https://' "$configuration" || { echo "Log transport is not HTTPS." >&2; exit 1; }
for setting in ServerCertificateFile ServerKeyFile TrustedCertificateFile; do
    path=$(sed -n "s/^$setting=//p" "$configuration" | tail -n 1)
    [ -n "$path" ] && [ -r "$path" ] || { echo "$setting is unavailable." >&2; exit 1; }
done
key_path=$(sed -n 's/^ServerKeyFile=//p' "$configuration" | tail -n 1)
key_mode=$(stat -c '%a' "$key_path")
[ "$key_mode" = 600 ] || { echo "Log-upload private key must use mode 0600." >&2; exit 1; }
systemctl is-enabled --quiet systemd-journal-upload.service
systemctl is-active --quiet systemd-journal-upload.service

compose() {
    if [ -n "$compose_project" ]; then
        docker compose -p "$compose_project" -f "$project_dir/compose.yaml" --project-directory "$project_dir" "$@"
    else
        docker compose -f "$project_dir/compose.yaml" --project-directory "$project_dir" "$@"
    fi
}
for service in web api postgres; do
    container=$(compose ps -q "$service")
    [ -n "$container" ] || { echo "$service is not running." >&2; exit 1; }
    driver=$(docker inspect --format '{{.HostConfig.LogConfig.Type}}' "$container")
    [ "$driver" = journald ] || { echo "$service does not use the journald driver." >&2; exit 1; }
done

before=$(stat -c '%Y:%s' "$state" 2>/dev/null || printf missing)
canary="fylkren-log-forwarding-$(date -u +%Y%m%dT%H%M%SZ)-$$"
logger --tag fylkren-log-forwarding "$canary"
attempt=0
while [ "$attempt" -lt 30 ]; do
    after=$(stat -c '%Y:%s' "$state" 2>/dev/null || printf missing)
    [ "$after" != "$before" ] && break
    sleep 1
    attempt=$((attempt + 1))
done
[ "${after:-missing}" != "$before" ] || { echo "Remote collector did not acknowledge journal progress." >&2; exit 1; }
systemctl is-active --quiet systemd-journal-upload.service
printf '{"remoteLogForwarding":"passed","transport":"https-mtls","containerLogDriver":"journald","acknowledgedCanary":"%s"}\n' "$canary"
