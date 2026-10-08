# Single-host server setup

This guide describes the supported Docker Compose profile for a single Fylkren host. Use synthetic data until the deployment has completed the organization's security, backup, identity, and acceptance checks.

Compose provisions a private installation CA and separate internal certificates for API and PostgreSQL. Gateway-to-API and API-to-database connections verify the CA and exact Compose service name, and PostgreSQL rejects plaintext network connections. Do not copy, expose or manually mount the CA private-key volume into a running service.

On Windows Server, the host runs Hyper-V and Fylkren runs inside a dedicated
Linux VM. Complete [Windows Server installation](WINDOWS_SERVER_INSTALLATION.md)
before applying the configuration in this guide.

For the authoritative install, backup, upgrade, rollback, and recovery procedure, use [Installation and upgrades](INSTALLATION_AND_UPGRADES.md). This page explains the deployment shape and the configuration decisions around it.

## Supported topology

```text
Browser
   │ HTTPS
External reverse proxy (optional)
   │ HTTP on trusted internal path
Fylkren web gateway
   ├── static web application
   └── reverse proxy to API
          └── PostgreSQL
```

Only the web gateway is published on the host. The API and PostgreSQL stay on internal Compose networks. The current profile is not highly available; no clustered high-availability deployment is currently planned or supported.

## Files and persistent data

A conventional installation path is:

```text
/data/docker/fylkren/
├── repository files
├── .env
└── backups/
```

The `.env` file and `backups/` directory are local and must never be committed. PostgreSQL and ASP.NET Data Protection keys live in named Docker volumes, not in the repository or container image.

Protect these as one recovery set:

- PostgreSQL backup;
- the exact matching Data Protection key volume;
- `.env` and deployment configuration;
- a record of the deployed commit/version and image provenance.

Losing the key ring can make protected TOTP and SMTP data unavailable even when the database is intact.

## First installation

Example installation into the conventional path:

```bash
cd /data/docker
git clone <authorized-repository-url> fylkren
cd /data/docker/fylkren
./deploy/compose/install.sh
docker compose build
docker compose up -d
```

The install script creates `.env` only when it does not exist and sets file mode `600`. It never replaces existing configuration. The internal TLS initializer creates a client-only API certificate and PostgreSQL maps that exact identity to the dedicated database role; the supported Compose path has no database password. After a successful upgrade and matched restore rehearsal, an obsolete `FYLKREN_DB_PASSWORD` line may be removed from `.env`.

Do not rerun first-install logic as an upgrade shortcut. Follow [Installation and upgrades](INSTALLATION_AND_UPGRADES.md), including backup and post-deployment verification.

## Core environment

For direct HTTP on a bounded trusted network:

```dotenv
FYLKREN_TRUST_FORWARDED_HEADERS=false
FYLKREN_FORWARDED_HEADER_LIMIT=1
FYLKREN_REQUIRE_HTTPS=false
FYLKREN_PUBLIC_URL=http://server-name:8080
```

For HTTPS behind a reverse proxy:

```dotenv
FYLKREN_TRUST_FORWARDED_HEADERS=true
FYLKREN_FORWARDED_HEADER_LIMIT=2
FYLKREN_REQUIRE_HTTPS=true
FYLKREN_PUBLIC_URL=https://fylkren.example
```

`FYLKREN_PUBLIC_URL` is the canonical public origin: scheme, host, and optional port only. Paths, user information, query strings, and fragments are invalid. The public host and port must match what users open, and the proxy must preserve the original `Host` value.

Base installation setting:

```dotenv
FYLKREN_MFA_ENABLED=true
FYLKREN_MFA_REQUIRED=true
```

Language, IANA time zone, 12/24-hour clock and measurement system are stored in
the database and managed under **Platform Manager → Appearance**. Changes take
effect immediately without restarting the API. Older `FYLKREN_DEFAULT_LANGUAGE`
and `FYLKREN_TIME_ZONE` values are imported once when an upgraded database does
not yet contain regional settings; they are not the ongoing source of truth.

Local login is controlled in **Platform Manager → Identity**. An existing `FYLKREN_LOCAL_AUTH_ENABLED` value is imported only when the database setting is first created.

`FYLKREN_MFA_REQUIRED=true` is the secure default. A customer-approved exception sets `FYLKREN_MFA_REQUIRED=false`; keep `FYLKREN_MFA_ENABLED=true` for optional TOTP/passkeys, or set both false to disable the capability without deleting credentials. Record owner, scope, rationale, credential-compromise risk, compensating controls and review date. An internal or air-gapped network alone is not a second factor. Platform Manager shows the exception as reduced security. `MFA_ENABLED=false` with `MFA_REQUIRED=true` is invalid and fails startup.

## Reverse proxy

Configure one HTTPS virtual host that forwards to the web gateway's host port (default `8080`). The proxy must replace `Host`, `X-Forwarded-Proto` and `X-Forwarded-For` for every request; appending or preserving values supplied by the internet client is not supported. Set `Host` to the public authority, `X-Forwarded-Proto` to `https` and `X-Forwarded-For` to the proxy-observed client address. Fylkren's gateway then adds its own hop and replaces `X-Forwarded-Host` and `X-Fylkren-Gateway-Client-IP` before calling the private API.

The API and PostgreSQL have no host ports. Block direct access to the web gateway's origin port whenever forwarded-header trust is enabled. If the reverse proxy runs on the Fylkren host, use `FYLKREN_HTTP_PORT=127.0.0.1:8080`. If it runs elsewhere, bind a firewall-restricted address that accepts only that proxy. A publicly reachable origin lets a caller impersonate the intermediary and is an invalid deployment.

A typical proxy definition uses:

- public domain: the host in `FYLKREN_PUBLIC_URL`;
- upstream scheme: `http`;
- upstream address: the Fylkren host's trusted network address;
- upstream port: `8080`;
- public certificate for the configured domain;
- HTTP-to-HTTPS redirect after certificate validation.

Enterprise AI assistance can hold one non-streaming request open while a local model generates its response. Fylkren gives the provider 300 seconds and the built-in web gateway gives AI routes 330 seconds. If the deployment's outer reverse proxy defines a response-header, read or request timeout, set the AI route to at least 330 seconds or apply a larger installation-owned margin. Do not enable automatic proxy retries for AI POST requests. A provider `429` remains a `429`, and its bounded numeric `Retry-After` delay must reach the browser.

Verify the proxy configuration with a request that supplies false `X-Forwarded-Proto`, `X-Forwarded-For`, `X-Forwarded-Host` and `X-Fylkren-Gateway-Client-IP` values. The proxy must replace them before forwarding. Recheck this after proxy upgrades or configuration imports.

WebSocket support can remain enabled at the proxy but Fylkren does not currently depend on WebSockets.

## First Platform Manager

After first startup, open the configured public URL. If no Platform Manager exists, the sign-in page shows a first-run setup form for display name, email, username, and password.

Creation is atomic and protected against parallel requests. After success:

- the new Platform Manager is signed in;
- first-run setup becomes permanently unavailable while that account exists;
- the public setup endpoint behaves as an unknown resource;
- no `FYLKREN_BOOTSTRAP_TOKEN` is required or supported.

Platform Manager is a system identity and does not belong to a site.

## Identity providers

OIDC, SAML, Active Directory, and LDAP are optional. They do not automatically create operational people or populate a site's Personnel list. External identities must be explicitly linked to an internal person, and site membership, unit placement, roles, and authority remain local.

Configure, test and activate these providers in **Platform Manager → Identity**. Provider configuration is stored in PostgreSQL; bind passwords and client secrets are protected with the persistent Data Protection key ring. No restart is required. Existing provider values from `.env` are imported once when this database-backed configuration is first introduced, then the GUI becomes authoritative.

Use the canonical [Access and identity](../administration/ACCESS_AND_IDENTITY.md) manual for configuration, mapping, migration, MFA, passkeys, and recovery. Security requirements include:

- HTTPS metadata and exact issuer/entity validation for OIDC and SAML;
- a permanent subject/NameID, never display name or email, as the external identity key;
- LDAPS or StartTLS for AD/LDAP;
- a read-only lookup identity limited to required attributes;
- stable `objectGUID` or `entryUUID` links;
- automatic lifecycle checks for disabled, expired and deleted directory accounts;
- no automatic matching by email, name, or username;
- safe local administrative recovery during rollout.

Keep the database and Data Protection key volume in the same backup/restore set. Without the matching keys, protected provider secrets cannot be recovered.

Directory lifecycle checking is enabled by default every 15 minutes. Configure
`FYLKREN_DIRECTORY_LIFECYCLE_INTERVAL_MINUTES` from 1 to 1440 and
`FYLKREN_DIRECTORY_LIFECYCLE_MISSING_CONFIRMATIONS` from 1 to 10. The latter
protects users from a single replication or search anomaly; transport or bind
failure is never counted as a missing account. AD has a secure default filter
for the `ACCOUNTDISABLE` flag and also checks account expiry. For another AD
schema, edit **Active-account filter** in the AD dialog. Generic LDAP deployments
must edit the corresponding field when their directory retains
disabled entries; for example, use the directory product's documented lock or
status attribute rather than copying an AD filter. Keep the filter static—no
user input is interpolated into it.

## SMTP and notifications

Platform Manager configures SMTP on the **Email** page, not in `.env`. Settings include host, port, STARTTLS, optional credentials, sender address, and sender name. STARTTLS is the normal choice; unencrypted SMTP is only for an explicitly trusted internal relay.

The SMTP password is protected with the persistent Data Protection key ring and is never returned to the browser or written to logs. Send a test message after configuration. Then configure site event categories as Site Manager and personal muting in each user's profile.

See [Notifications](NOTIFICATIONS.md) for recipient rules, templates, queueing, retries, status, failure diagnosis, and audit.

## Production federation prerequisites

Federation is disabled by default and is activated by Platform Manager in the application, not through `.env`. Before the GUI will permit activation, each independent installation must have:

- `FYLKREN_PUBLIC_URL` set to its final HTTPS origin;
- `FYLKREN_TRUST_FORWARDED_HEADERS=true` and `FYLKREN_REQUIRE_HTTPS=true` in the supported reverse-proxy topology;
- a certificate chain trusted by the other API container and outbound TCP/DNS reachability to the peer;
- clocks kept within five minutes by customer-controlled time infrastructure;
- its own PostgreSQL database, Data Protection key volume, Instance ID and Enterprise license;
- a rehearsed combined database/key-volume backup and recovery procedure.

Do not clone a live installation to create a peer: a clone retains the same identity and signing key. Follow the [complete bilateral GUI procedure](../administration/FEDERATION.md). Activation requires no container restart. Keep it disabled until both Platform Managers have independently compared fingerprints and passed the connection test. That test also retrieves the signed catalog of active top-level sites; no site publication, site-pair or direction approval is required.

## Start and verify

```bash
docker compose up -d
sudo ./deploy/host-status/install.sh
docker compose ps
docker compose logs --tail=100 api
```

Verify through the same public route users will use:

```bash
curl --fail --silent --show-error https://fylkren.example/health
curl --fail --silent --show-error \
  https://fylkren.example/api/configuration/public
```

Confirm that:

- PostgreSQL and API report healthy;
- after signing in, the version displayed in the application matches the deployed release (the anonymous configuration endpoint intentionally omits it);
- the public URL and HTTPS state are correct;
- API and PostgreSQL are unreachable directly from untrusted networks;
- first-run setup disappears after Platform Manager creation;
- the configured sign-in methods work in separate sessions;
- no real operational data was entered before acceptance and backup checks.

The host-status collector supplies disk capacity, explicitly recorded backup
time, container health and restart counts to Platform Manager without exposing
the Docker socket to the API. Install and verify it using
[Host status integration](HOST_STATUS.md).

## Air-gapped installation

Fylkren has no mandatory runtime internet lookup. For an air-gapped environment, transfer and verify all required source archives or container images, package caches, signatures/checksums, and documentation through the organization's approved media process.

External OIDC/SAML, directory, SMTP, DNS, time, certificate, and update services must either exist inside the boundary or remain disabled. Time synchronization is particularly important for TLS, TOTP, audit chronology, and distributed identity protocols.

## Troubleshooting order

1. Check `docker compose ps` and container health.
2. Read the API startup log for a concrete, sanitized error.
3. Verify `.env` syntax, file permissions, public URL, and proxy headers.
4. Verify database and key volumes still exist and belong to the expected Compose project.
5. Test DNS, certificate trust, firewall, and connectivity from the API container for enabled integrations.
6. Use Platform Manager's technical status and provider test functions.
7. Do not reset volumes, regenerate `.env`, or remove keys as a troubleshooting shortcut.

For rollback and failed migration handling, follow [Installation and upgrades](INSTALLATION_AND_UPGRADES.md).
