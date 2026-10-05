# Host status integration

Platform Manager's **Platform → System status** view combines application-level
health with a sanitized snapshot collected on the Fylkren runtime host. The
snapshot supplies:

- free and total capacity for the filesystem containing the Fylkren installation;
- the latest explicitly recorded complete backup set;
- Docker state, health and restart count for web, API and PostgreSQL;
- host NTP synchronization state, current reported offset and a 1,000 ms alert boundary;
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
Consequently, System status becomes reduced after 36 hours if the external
scheduler has not successfully run the Fylkren backup command, even when that
external system has separately copied other files. The external system must
monitor its own transfer and retention jobs; those results are outside the
Fylkren status signal.

Restart counts come from Docker and reset if the container is deleted and
recreated. They identify repeated restarts within the current container
lifetime; they are not a durable incident history.

Time synchronization is healthy only when Chrony reports normal synchronization,
or `timedatectl` reports an NTP-synchronized host, and the active service supplies
an absolute offset no greater than 1,000 milliseconds. A synchronized host without an available offset is reduced;
an unsynchronized host or excessive offset is down. The signal is shown in
**Platform → System status** and becomes unknown with a stale snapshot. Configure
and monitor the host's approved NTP source separately; containers share this host
clock and must not run their own time service.

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
to approved off-host storage. The command also collects a fresh host-status
snapshot, so the new backup state is visible immediately rather than after the
next timer interval. A restore rehearsal remains mandatory and is recorded in
the organization's durable operations log rather than inferred by Fylkren.

The host-status timer only measures state; it does not create backups. An
external backup system should invoke the command and require a successful exit
status. Fylkren keeps the newest 14 complete local sets by default; configure
`FYLKREN_LOCAL_BACKUP_RETENTION_COUNT` from 2 to 365 in `.env`. Cleanup removes
only older timestamped directories with a `COMPLETE` marker and never removes
unknown, symbolic-link or `INCOMPLETE` directories. The external system must
transfer only complete sets and apply its own independent remote retention.

Restore is intentionally unavailable inside the running GUI. Use the validated
`deploy/compose/restore.sh` command for an in-place recovery, or on a replacement
that remains isolated until the original is fenced, as described in
[Installation and upgrades](INSTALLATION_AND_UPGRADES.md#restore-and-isolated-rehearsal).

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
timedatectl show --property=NTPSynchronized --value
timedatectl timesync-status --no-pager
chronyc tracking
```

Confirm that `runtime/host-status.json` exists, is readable and is mounted in the
API container:

```bash
docker compose exec -T api \
  test -r /run/fylkren-host-status/host-status.json
```

Do not solve a status failure by mounting `/var/run/docker.sock` into the API.
That would give a compromised application a path to host-level Docker control.
