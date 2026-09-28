#!/bin/sh
set -eu

if [ "$(id -u)" -ne 0 ]; then
    echo "Run this installer with sudo." >&2
    exit 1
fi

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
project_dir=$(CDPATH= cd -- "$script_dir/../.." && pwd)
case "$project_dir" in
    *[!A-Za-z0-9_./-]*)
        echo "The installation path contains characters that are unsafe in a systemd unit: $project_dir" >&2
        exit 1
        ;;
esac

install -d -m 0755 /usr/local/lib/fylkren
install -m 0755 "$script_dir/collect-host-status.sh" /usr/local/lib/fylkren/collect-host-status.sh
install -d -m 0755 "$project_dir/runtime"

cat >/etc/systemd/system/fylkren-host-status.service <<EOF
[Unit]
Description=Collect sanitized Fylkren host status
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
ExecStart=/usr/local/lib/fylkren/collect-host-status.sh $project_dir
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=read-only
ProtectSystem=strict
ReadWritePaths=$project_dir/runtime
EOF

cat >/etc/systemd/system/fylkren-host-status.timer <<EOF
[Unit]
Description=Refresh Fylkren host status

[Timer]
OnBootSec=2min
OnUnitActiveSec=5min
AccuracySec=30s
Persistent=true
Unit=fylkren-host-status.service

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable --now fylkren-host-status.timer
systemctl start fylkren-host-status.service
echo "Fylkren host status collection is active."
