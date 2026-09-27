# Installation and upgrades

This is the canonical container installation and upgrade procedure. Examples use `/data/docker/fylkren`; adapt paths, release references and backup targets to the environment.

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
docker compose ps
docker compose logs --tail=100 api
```

`install.sh` creates `.env` only when absent, generates a random database password and applies mode `600`. Review public origin, proxy/HTTPS mode, language, timezone and authentication before starting.

`FYLKREN_FEDERATION_RETENTION_DAYS` controls federation-history retention and defaults to 2,555 days (seven years); supported values are 365–3,650. Once per day, including shortly after API startup, maintenance removes bounded batches of delivered outbound messages and inbound receipts older than the cutoff only when their local work is terminal, and federation audit events older than the same cutoff. Pending, retrying and failed messages and active-work correlation records are retained. Archive evidence required beyond the configured period before lowering it; deleted history is not restored by later increasing the value.

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

Create a database dump outside the database volume:

```bash
mkdir -p /data/docker/fylkren/backups
docker compose exec -T postgres pg_dump -U fylkren -d fylkren -Fc > /data/docker/fylkren/backups/fylkren-YYYYMMDD-HHMM.dump
ls -lh /data/docker/fylkren/backups/fylkren-YYYYMMDD-HHMM.dump
```

Back up configuration securely:

```bash
cp -p .env /data/docker/fylkren/backups/env-YYYYMMDD-HHMM.backup
chmod 600 /data/docker/fylkren/backups/env-YYYYMMDD-HHMM.backup
```

Back up the exact Data Protection volume through the organization's approved volume/host backup method. Database, `.env` and keys must represent one restore point. A backup is unverified until restored in an isolated environment.

## Isolated restore rehearsal

Restore only onto an isolated replacement host or network where the original installation cannot receive federation or user traffic. Never connect the original and a restored copy simultaneously: they share the same Instance ID and signing identity. Verify backup checksums, custody record, application version and PostgreSQL compatibility before starting.

1. Restore the matching `.env` securely and keep the API stopped.
2. Start PostgreSQL alone, create an empty `fylkren` database and feed the custom-format dump to `pg_restore --exit-on-error --no-owner`.
3. Restore the exact Data Protection volume from the same recovery point before starting any API container. Do not allow an empty replacement volume to become the accepted recovery state.
4. Start the complete stack and verify health, login, Instance ID, protected settings and federation identity. The federation fingerprint must equal the pre-disaster value and `keyUsable` must be true.
5. From an existing peer, perform a signed probe. A matched disaster-recovery replacement retains its pin and must not require lost-key approval. Then exercise one authorized delivery and confirm one signed receipt/counterpart.
6. Prove the restore point by checking that a recorded post-backup marker is absent. Record durations, checksums, versions, operator, target isolation and results, then destroy the rehearsal environment securely.

If the database is restored without its matching key ring, protected federation, SMTP and TOTP material may remain present but unusable. Stop and correct the restore; do not invoke federation lost-key recovery merely to compensate for an available but omitted key-volume backup. Use the controlled recovery flow only after the original key is confirmed lost. Production failover additionally requires fencing the original host, changing DNS/routing as approved and verifying there is exactly one live installation identity.

## Test-environment upgrade

```bash
cd /data/docker/fylkren
git pull --ff-only
git diff HEAD@{1} -- deploy/compose/.env.example compose.yaml
docker compose build
docker compose up -d --force-recreate
```

Merge required new variables without replacing existing secrets. Do not interrupt API startup while migrations are running.

The one-time destructive development baseline transition was completed at 0.55.0. It must never be repeated. Every later schema change is a forward, versioned EF Core migration that preserves installed data; installed migrations are not rewritten or removed.

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
