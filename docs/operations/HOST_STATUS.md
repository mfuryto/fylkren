# Host status integration

Platform Manager's **Platform → System status** view combines application-level
health with a sanitized snapshot collected on the Fylkren runtime host. The
snapshot supplies:

- free and total capacity for the filesystem containing the Fylkren installation;
- the latest explicitly recorded complete backup set;
- Docker state, health and restart count for web, API and PostgreSQL;
- collection time, runtime platform and hostname.

In the Windows Server topology, the runtime host is the dedicated Hyper-V Linux
VM. Windows Server and Hyper-V capacity must additionally be monitored by the
organization's host-management system.

## Security design

The API does not receive the Docker socket and cannot control Docker or the
host. A root-owned systemd oneshot collector executes outside the containers and
writes one bounded JSON snapshot. Compose mounts only the `runtime/` directory
read-only into the API container. The API accepts schema version 1, limits the
file to 64 KiB and validates timestamps, lengths, status values and numeric
ranges before displaying it.

The snapshot contains no environment variables, container logs, image
configuration, addresses, credentials, volume paths or operational content.
Treat it as diagnostic information and restrict the Platform Manager role
accordingly.

## Install or update the collector

From the Fylkren repository on the Linux server or Hyper-V Linux VM:

```bash
cd /data/docker/fylkren
sudo ./deploy/host-status/install.sh
```

The installer copies the maintained collector to `/usr/local/lib/fylkren`,
creates a hardened oneshot service and enables a timer that runs two minutes
after boot and every five minutes thereafter. Run the installer again after an
application upgrade so changes to the collector and service hardening are
applied.

Verify it:

```bash
systemctl status fylkren-host-status.timer
sudo systemctl start fylkren-host-status.service
systemctl status fylkren-host-status.service
sed -n '1p' /data/docker/fylkren/runtime/host-status.json
```

The status file is local runtime data and is excluded from Git. It is replaced
atomically so the API never reads a partially written snapshot.

## Status interpretation

The API treats a snapshot older than 15 minutes as stale by default. Configure
`FYLKREN_HOST_STATUS_MAXIMUM_AGE_MINUTES` from 1 to 1,440 if the timer interval
is deliberately changed.

Disk status is reduced when less than 15 percent or 5 GiB remains. This is an
early operational warning, not a capacity forecast. Monitor VHDX growth and the
physical Hyper-V storage separately on Windows Server.

Backup status is reduced when no complete set is recorded or the latest set is
older than `FYLKREN_BACKUP_WARNING_HOURS`, which defaults to 36 hours. Recording
a set proves only that three nonempty artifacts existed and their SHA-256 hashes
were calculated. It does not prove off-host transfer, retention or restore.

Restart counts come from Docker and reset if the container is deleted and
recreated. They identify repeated restarts within the current container
lifetime; they are not a durable incident history.

## Record a complete backup set

From the Fylkren repository, create and register the entire set in the
Git-ignored `<Fylkren root>/backups/` directory. The root is detected from the
script location and is not hardcoded:

```bash
cd /data/docker/fylkren
sudo ./deploy/compose/backup.sh
```

The command creates the database dump, `.env` copy, matching Data Protection
keys, manifest and checksums under one timestamped directory. It rejects partial
sets and records the completion time automatically. Copy the complete directory
to approved off-host storage. A restore rehearsal remains mandatory and is
recorded in the organization's durable operations log rather than inferred by
Fylkren.

`deploy/host-status/record-backup.sh` is retained only for backup sets created by
an approved external backup system. Pass that command the three existing,
nonempty artifact paths; do not use placeholder filenames.

## Troubleshooting

If Platform Manager reports no measurement or a stale measurement:

```bash
systemctl list-timers fylkren-host-status.timer
systemctl status fylkren-host-status.service
journalctl -u fylkren-host-status.service --since today
sudo /usr/local/lib/fylkren/collect-host-status.sh /data/docker/fylkren
```

Confirm that `runtime/host-status.json` exists, is readable and is mounted in the
API container:

```bash
docker compose exec -T api \
  test -r /run/fylkren-host-status/host-status.json
```

Do not solve a status failure by mounting `/var/run/docker.sock` into the API.
That would give a compromised application a path to host-level Docker control.
