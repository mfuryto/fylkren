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

## Outbound integration configuration

Outbound webhook, federation and identity-provider HTTP clients require HTTPS, disable redirects and validate DNS results before connecting to the checked address. System HTTP proxies are not used by these clients. An integration that resolves to loopback or RFC1918/IPv6 private addresses requires a deployment-owned exception in `.env`:

```dotenv
FYLKREN_OUTBOUND_PRIVATE_ORIGINS=https://idp.internal:8443;https://peer.internal:443;https://llama.internal:11443
FYLKREN_OUTBOUND_IDENTITY_ORIGINS=https://keys.identity.example
```

Use only exact required origins, including nondefault ports. Do not include paths, queries, credentials or wildcards. Webhooks, federation and identity providers still require HTTPS. An AI provider alone may use an exact allowlisted HTTP origin when it resolves exclusively to private/loopback addresses; document the unencrypted closed-network risk and restrict the destination port to the Fylkren host. Private exceptions never permit link-local/cloud metadata, multicast or reserved addresses. Check existing internal IdP, webhook, federation and local AI destinations before upgrading; merge these settings deliberately and recreate the API container after changing them. Public integrations need no private exception.

OIDC backchannel requests default to the configured authority's origin. Providers using separate token, userinfo or JWKS origins need those origins in `FYLKREN_OUTBOUND_IDENTITY_ORIGINS`; private destinations need both approvals. Metadata responses are bounded to 2,000,000 bytes, federation responses to 1,000,000 bytes with existing stricter operation limits retained. Webhook delivery accepts status headers and does not read response bodies. No database migration or event/API contract change is required.

SAML metadata uses the same bounded HTTPS download, rejects DTDs and expired/mismatched metadata, and refreshes on demand after at most 15 minutes or at metadata expiry. Failed renewal does not retain stale metadata. Signing certificates from approved metadata still validate SAML responses/assertions in Sustainsys. Redirect/POST SSO remains supported; artifact-resolution downloads are disabled. The identity-provider response must supply metadata directly rather than redirect to another URL.

Before upgrading, rotate every OIDC and SAML signing key to RSA-3072 or stronger and verify the saved provider configuration. Fylkren rejects RSA-2048 provider metadata/JWKS after this release. Existing RSA-2048 WebAuthn credentials also stop authenticating; ensure affected users have TOTP or another approved passkey, then remove and re-register those credentials. No database migration is required.

SMTP and AD/LDAP use a configured server name or IP plus a separate port (1–65535), rather than an outbound URL. Remove embedded schemes, ports, paths, credentials, whitespace and host lists before upgrading. Reserved/link-local/cloud-metadata addresses are rejected; ordinary explicitly configured private relays/directories remain supported. No HTTP private-origin variable is required for these non-HTTP transports. SMTP connects an approved DNS result directly. AD/LDAP retains the configured name for certificate validation and rejects every actual connection candidate outside the complete preflight-approved result set. Deployment egress rules should still restrict configured service destinations and block metadata/reserved networks as defense in depth.

Directory connections retain required LDAPS or StartTLS and disabled referral chasing. Linux StartTLS initializes its target with a credential-free RootDSE request before TLS negotiation; it never binds credentials in plaintext. Referral/incomplete responses cannot approve a provider or count as confirmed missing-account evidence. SMTP StartTLS never falls back to plaintext. Explicit SMTP `none` remains supported for existing controlled relay configurations; it does not establish TLS compliance. Test delivery has a 10-second send deadline; queued delivery retains its existing 30-second send deadline, with DNS preflight bounded separately to 10 seconds.

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

`install.sh` creates `.env` only when absent and applies mode `600`. PostgreSQL authentication uses the installation-issued API client certificate; no database password is created. Review public origin, proxy/HTTPS mode and authentication before starting. After the first Platform Manager signs in, configure language, IANA time zone, clock format and measurement system under **Appearance**; these values are stored in the database and do not require a restart.

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
the current stack, replaces its PostgreSQL, Data Protection key-ring and custody volumes and
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

If the database is restored without its matching key ring and key-encryption custody, protected federation, SMTP and TOTP material may remain present but unusable. Stop and correct the restore; do not invoke federation lost-key recovery merely to compensate for an available but omitted key-volume backup. Use the controlled recovery flow only after the original key is confirmed lost. Production failover additionally requires fencing the original host, changing DNS/routing as approved and verifying there is exactly one live installation identity.

Provider secrets are no longer read from the production Compose environment. Before upgrading an installation that has never started a GUI-managed identity-provider release, first upgrade to a prior compatible release once so its one-time import writes protected provider settings, then remove `FYLKREN_OIDC_CLIENT_SECRET`, `FYLKREN_AD_BIND_PASSWORD` and `FYLKREN_LDAP_BIND_PASSWORD` from `.env`. Current installations manage these values only under **Platform Manager → Identity**.

The supported Compose services always use `journald`. During production qualification, choose whether to enable the separate HTTPS/mTLS collector path described in [Remote security-log forwarding](LOG_FORWARDING.md). If enabled, its acknowledgement verifier must pass. If omitted, record the accountable deployment owner's explicit risk exception and compensating controls; the installation remains operational but cannot claim ASVS 16.4.3.

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

For `20261002220000_WorkActivityArchiveGuards`, stop every old API/worker instance before starting the new API that applies migrations. The schema rejects old writers of WorkItem-owned content lacking the supported transaction capability. The additive foundation is reversible before cutover; after contextual activity has been recorded, schema downgrade is blocked. Use a forward fix or restore the matched database/configuration/key/image set. Never remove guards or alter migration history to run an old writer. Remote installations retain the existing versioned federation contract and do not share this schema gate. See [delivery and recovery scope](../../dev-notes/architecture/EVENT_ACTIVITY_AND_INFORMATION_LIFECYCLE.md#deployment-and-recovery).

For `20261004085939_AutomaticWorkLifecycle`, the new writer automatically locks eligible terminal WorkItems and archives them after operational follow-up and required delivery are resolved. Existing terminal records are reconciled in bounded batches after startup; they are retained, not deleted. Previously explicitly reopened active records remain paused for editing. Learning treatment can continue against locked/archived WorkItems while original observations and whole-Site boundaries remain protected. Existing delivery failures can keep a task locked but unarchived until resolved. No new customer retention period is introduced.

Migration `20261005220000_AddBrowserSessionRegistry` adds the authoritative browser-session registry. Cookies issued by an older version do not contain a registry identifier and are rejected after upgrade, so every user must sign in once after deployment. This does not remove accounts or operational data. Verify Profile lists the new current session and that terminating a separate test session rejects only that browser.

Mandatory MFA is enabled by default through `FYLKREN_MFA_REQUIRED=true`. Existing unenrolled users are not locked out: their next valid first factor opens only the TOTP enrollment screen, and operational/administrative access remains blocked until enrollment succeeds. Directory and SSO users use the same supplemental Fylkren TOTP flow. Before deployment, confirm staff have authenticator applications and a recovery-code custody process.

A customer-approved single-factor exception must set `FYLKREN_MFA_REQUIRED=false` and explicitly choose `FYLKREN_MFA_ENABLED=true` for optional MFA or `false` to disable it. Record the owner, scope, rationale, risks, compensating controls and review date described in [Access and identity](../administration/ACCESS_AND_IDENTITY.md#mfa-and-passkeys). Platform Manager displays the exception as reduced security. Existing `.env` files are preserved during upgrade, so add both variables before stopping the old API; `MFA_ENABLED=false` with an absent/default-true requirement deliberately fails startup instead of silently weakening policy.

The supported Compose topology automatically creates installation-specific internal TLS certificates for gateway-to-API and API-to-PostgreSQL traffic, including a client-only database identity for API. `docker compose up` runs the bounded `tls-init` service before PostgreSQL and API, then mounts only the trust anchor and keys required by each role. Keep the five `fylkren-tls-*` volumes with the installation. They are transport identities rather than customer-data backup artifacts and can be regenerated during a fenced recovery. Restart the complete Compose project after certificate renewal. A previously saved unencrypted SMTP configuration no longer sends mail; select STARTTLS and successfully test the relay before re-enabling delivery.

Once automatic facts or editing pauses exist, downgrade is blocked: use a forward fix or matched database/key/configuration/image restore. Keep all old replicas stopped throughout the upgrade. See [automatic lifecycle scope](../../dev-notes/architecture/EVENT_ACTIVITY_AND_INFORMATION_LIFECYCLE.md#automatic-workitem-lifecycle--2026-10-04).

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
