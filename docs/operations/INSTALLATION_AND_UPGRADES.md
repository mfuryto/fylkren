# Installation and upgrades

This is the canonical container installation and upgrade procedure. Examples use `/data/docker/fylkren`; adapt paths, release references and backup targets to the environment.

For a Windows Server host, first create the dedicated Hyper-V Linux VM described
in [Windows Server installation](WINDOWS_SERVER_INSTALLATION.md), then run this
procedure inside that VM. Do not install Docker Desktop on Windows Server and do
not attempt to run the repository's Linux images as Windows containers.

Installation backup/restore and customer-data export/import are separate capabilities. Backups restore this installation and require PostgreSQL, configuration and the matching Data Protection keys. Portable exports support migration, archival and customer exit, exclude authentication secrets and cannot replace a tested disaster-recovery backup. See [Portable export and customer exit](../api/PORTABLE_EXPORT_FORMAT.md).

## Rules

- Read the release notes and `CHANGELOG.md` first.
- Never upgrade without a current PostgreSQL dump plus matching `.env` and Data Protection key backup.
- Never remove database or key volumes during an ordinary upgrade.
- Preserve `.env`; merge new settings from `.env.example` deliberately.
- Use a tagged release in production when releases are published. Pulling `main` is appropriate only for the current test environment.
- Plan a maintenance window because the API applies migrations at startup.

## First installation

Prerequisites: Docker Engine, Docker Compose v2, Git, OpenSSH, OpenSSL, repository access and a free local port (default `8080`). Public deployment also requires DNS, HTTPS and a correctly configured reverse proxy.

```bash
cd /data/docker
git clone git@github.com:mfuryto/fylkren.git fylkren
cd /data/docker/fylkren
./deploy/compose/install.sh
docker compose build
docker compose up -d
sudo ./deploy/host-status/install.sh
docker compose ps
docker compose logs --tail=100 api
```

`install.sh` creates `.env` only when absent, generates a random database password and applies mode `600`. Review public origin, proxy/HTTPS mode and authentication before starting. After the first Platform Manager signs in, configure language, IANA time zone, clock format and measurement system under **Appearance**; these values are stored in the database and do not require a restart.

`FYLKREN_FEDERATION_RETENTION_DAYS` controls federation-history retention and defaults to 2,555 days (seven years); supported values are 365–3,650. Once per day, including shortly after API startup, maintenance removes bounded batches of delivered outbound messages and inbound receipts older than the cutoff only when their local work is terminal. Security audit records are retained independently and are not deleted by this transport-retention setting. Locally owned evidence is also retained while its Site/work ancestry is closed, archived or held; independent owners retain their own cleanup eligibility. Pending, retrying and failed messages and active-work correlation records are retained. Archive evidence required beyond the configured period before lowering it; deleted history is not restored by later increasing the value.

Community starts without a license or network access. Fylkren already contains the production issuer's **public** SPKI verification key. To enable Enterprise features, Platform Manager imports a signed license on the License page without configuring a key, reinstalling, changing images or migrating data. An optional `FYLKREN_LICENSE_PUBLIC_KEY_SPKI` value adds another trusted public key for controlled rotation or isolated tests and requires an API restart. Never place the issuer's private key on this server. An absent or expired license leaves customer data accessible and disables only entitled actions. See [Community and Enterprise entitlements](../architecture/EDITION_ENTITLEMENTS.md) for feature allocation, issuance, transitions and recovery requirements.

Verify `/health`, complete the one-time Platform Manager setup, test login and one administration page, and perform a backup/restore rehearsal before operational use.

## Before every upgrade

Record current state:

```bash
cd /data/docker/fylkren
git rev-parse --short HEAD
git status --short
docker compose ps
docker compose images
```

Stop if the working tree contains unexplained local changes.

Create and register one complete, timestamped backup set:

```bash
sudo ./deploy/compose/backup.sh
```

The script derives the actual Fylkren root from its own location; no installation
path is hardcoded. It creates `<Fylkren root>/backups/fylkren-<UTC timestamp>/`
with the PostgreSQL custom-format dump, protected `.env` copy, matching Data
Protection key archive, manifest and SHA-256 checksums. It marks the directory
`COMPLETE` only after all artifacts have been created, then updates Platform
Manager's System status immediately. The `backups/` directory is excluded from
both Git and Docker build contexts and is restricted to root.

To use another location, supply one absolute directory:

```bash
sudo ./deploy/compose/backup.sh /approved/backup
```

The local backup directory is not sufficient disaster recovery if the Fylkren
host or its storage fails. Transfer the complete timestamped directory to
approved off-host storage, apply retention policy and perform the isolated
restore rehearsal below. A backup remains unverified until it has been restored.

Fylkren deliberately does not schedule backups. The intended production flow is
that the organization's external backup scheduler first runs
`sudo ./deploy/compose/backup.sh`, continues only when it exits successfully,
then copies the newly completed `backups/fylkren-<UTC timestamp>/` directory to
off-host storage. Fylkren retains the 14 newest complete local sets by default
and removes older complete sets immediately before creating another. Configure
`FYLKREN_LOCAL_BACKUP_RETENTION_COUNT` from 2 to 365 in `.env`. Unknown folders,
symbolic links and sets marked `INCOMPLETE` are never removed automatically.
The external system independently owns remote retention, monitoring and
deletion. Never copy a directory that still has an `INCOMPLETE` marker.

## Restore and isolated rehearsal

An actual recovery can restore in place on the original server. A rehearsal must
use an isolated environment. A replacement server must remain isolated until the
original is stopped or fenced; never run two copies simultaneously because they
share the same Instance ID and signing identity. Verify custody, application
version and PostgreSQL compatibility before starting.

On the target installation, check out a compatible Fylkren version, build the
images and place the complete backup directory on the host. Then run:

```bash
cd /path/to/fylkren
sudo ./deploy/compose/restore.sh \
  /absolute/path/to/fylkren-YYYYMMDDTHHMMSSZ \
  --confirm-destructive-restore
```

The confirmation is deliberately verbose because the command permanently stops
the current stack, replaces its PostgreSQL and Data Protection volumes and
overwrites `.env`. Before changing anything, it requires a `COMPLETE` set,
verifies every SHA-256 checksum, validates the database dump and rejects unsafe
key-archive paths. It restores the database and matching keys before starting
the API, waits for container health and refreshes host status.

After the command succeeds, verify health, login, Instance ID, protected
settings and federation identity. The federation fingerprint must equal the
pre-disaster value and `keyUsable` must be true. From an existing peer, perform a
signed probe; a matched replacement retains its pin and must not require
lost-key approval. Exercise one authorized delivery and confirm its signed
receipt. Prove the recovery point with a known post-backup marker, and record
durations, checksums, versions, operator, isolation and results. Destroy a
rehearsal environment securely when testing is complete. Before a restored
replacement receives traffic, prove that the original installation is stopped
or fenced.

If the database is restored without its matching key ring, protected federation, SMTP and TOTP material may remain present but unusable. Stop and correct the restore; do not invoke federation lost-key recovery merely to compensate for an available but omitted key-volume backup. Use the controlled recovery flow only after the original key is confirmed lost. Production failover additionally requires fencing the original host, changing DNS/routing as approved and verifying there is exactly one live installation identity.

## Test-environment upgrade

```bash
cd /data/docker/fylkren
git pull --ff-only
git diff HEAD@{1} -- deploy/compose/.env.example compose.yaml
docker compose build
sudo ./deploy/compose/backup.sh
docker compose stop web api
docker compose up -d --force-recreate
sudo ./deploy/host-status/install.sh
```

Merge required new variables without replacing existing secrets before building and backing up. Run the backup while the current stack is still running; proceed only if it succeeds. Stop all old API/worker instances before starting the new version, including any replicas outside this Compose stack. This is required for the WorkItem activity/lifecycle cutover below. Do not interrupt API startup while migrations are running.

The one-time destructive development baseline transition was completed at 0.55.0. It must never be repeated. Every later schema change is a forward, versioned EF Core migration that preserves installed data; installed migrations are not rewritten or removed.

Final-report templates, workflow templates and planning/execution workflow names and steps become Site-owned data when the Site is created. Upgrade migrations must not translate, reset or replace them. New defaults apply only to newly created Sites unless Site Manager explicitly saves a change. The guarded 0.70 development repair restores only complete legacy default sets affected by the earlier translation migration; any workflow with customized structure or labels and any differently customized report template is excluded.

## Post-upgrade verification

```bash
docker compose ps
docker compose logs --tail=200 api
curl -fsS http://localhost:8080/health
```

Then verify:

1. the public configuration endpoint reports the expected version;
2. configured local and/or external login works;
3. Platform Manager administration and Site Manager site isolation work;
4. representative Tasks, Planning, Execution and Reports views load;
5. changed SMTP/identity integrations are tested;
6. logs show no repeated errors or failed migrations;
7. HTTPS deployments retain redirect and security headers.

Record source and target versions, time, operator, restore point, non-secret configuration changes, migrations and result in the organization's operations log.

## WorkItem activity/lifecycle cutover

For `20261002220000_WorkActivityArchiveGuards`, stop every old API/worker instance before starting the new API that applies migrations. The schema rejects old writers of WorkItem-owned content lacking the supported transaction capability. The additive foundation is reversible before cutover; after contextual activity has been recorded, schema downgrade is blocked. Use a forward fix or restore the matched database/configuration/key/image set. Never remove guards or alter migration history to run an old writer. Remote installations retain the existing versioned federation contract and do not share this schema gate. See [delivery and recovery scope](../architecture/EVENT_ACTIVITY_AND_INFORMATION_LIFECYCLE.md#deployment-and-recovery).

For `20261004085939_AutomaticWorkLifecycle`, the new writer automatically locks eligible terminal WorkItems and archives them after operational follow-up and required delivery are resolved. Existing terminal records are reconciled in bounded batches after startup; they are retained, not deleted. Previously explicitly reopened active records remain paused for editing. Learning treatment can continue against locked/archived WorkItems while original observations and whole-Site boundaries remain protected. Existing delivery failures can keep a task locked but unarchived until resolved. No new customer retention period is introduced.

Once automatic facts or editing pauses exist, downgrade is blocked: use a forward fix or matched database/key/configuration/image restore. Keep all old replicas stopped throughout the upgrade. See [automatic lifecycle scope](../architecture/EVENT_ACTIVITY_AND_INFORMATION_LIFECYCLE.md#automatic-workitem-lifecycle--2026-10-04).

## Failure and rollback

Preserve evidence and do not delete containers, volumes or database files:

```bash
docker compose ps
docker compose logs --tail=300 api
docker compose logs --tail=200 web
```

Inspect logs and `__EFMigrationsHistory`; never insert migration rows or modify tables manually without a documented repair. Rolling application code back against an upgraded database is safe only when explicitly documented. Full rollback restores application, database, `.env` and keys from the same restore point and is rehearsed outside production first.

## Image verification

Scan freshly built runtime images and the repository with an up-to-date Trivy database:

```bash
trivy image --scanners vuln --severity UNKNOWN,LOW,MEDIUM,HIGH,CRITICAL fylkren-api
trivy image --scanners vuln --severity UNKNOWN,LOW,MEDIUM,HIGH,CRITICAL fylkren-web
trivy image --scanners vuln --severity UNKNOWN,LOW,MEDIUM,HIGH,CRITICAL fylkren-postgres
trivy fs --ignorefile .trivyignore.yaml --scanners vuln,secret,misconfig --severity UNKNOWN,LOW,MEDIUM,HIGH,CRITICAL .
```

Resolve fixable High/Critical findings before production. Document and assess findings without an available vendor fix; do not hide them by lowering the scan severity.

## Air-gapped upgrade

An isolated environment uses a versioned package containing application images/source as applicable, release notes, checksums and migration notes. Verify it through the approved transfer process before installation. The same backup and post-upgrade checks apply. Package signing remains roadmap work and must not be represented as current functionality.

## Common-event consumer cutover

Before this schema upgrade, stop unsupported older API nodes after taking the matched database/key backup. Do not run older writers alongside the consumer reconciliation. Startup drains the known unconsumed legacy notification boundary in durable bounded batches; interrupted startup can be restarted against the same database. Existing queued content and delivery history remain retained, and the final checkpoint prevents speculative historical replay. Webhook migration transfers only eligible pending obligations to the common projection ledger. After completed cutover, downgrade is deliberately rejected before removing schema; use a tested forward correction or the documented isolated matched backup/key recovery procedure. This upgrade does not enable irreversible deletion, anonymisation or customer retention execution.
