# Deployment and offline operation

## Supported topology

The supported deployment is a single-node Docker Compose stack:

```text
web gateway → API → PostgreSQL
```

Web and API run without Linux capabilities, with read-only root filesystems, explicit temporary filesystems and `no-new-privileges`. Runtime processes are non-root. PostgreSQL is available only on the private backend network; the web container cannot connect directly to it.

The gateway becomes available only after the API health check succeeds. API and PostgreSQL ports are not published as public application endpoints.

The stack runs directly on a supported 64-bit Linux host. On Windows Server,
run the unchanged Linux-container stack inside a dedicated Hyper-V Linux VM by
following [Windows Server installation](WINDOWS_SERVER_INSTALLATION.md). Docker
Desktop is not supported on Windows Server, and the current images are not
Windows containers. Users access Fylkren through a modern browser on Windows,
Linux or macOS. Direct non-container deployment is architecturally possible but
is not a maintained installation path.

The current Compose profile is not redundant. Customers requiring high availability need a separately assessed deployment architecture; no multi-node Fylkren profile is currently planned or supported. Instance federation connects independent installations and does not provide automatic failover or database replication.

## Public origin, HTTPS and proxies

`FYLKREN_PUBLIC_URL` is the canonical origin used for authentication, permalinks, email links and Host validation. It contains scheme, hostname and optional port only.

| Mode | Trust forwarded headers | Require HTTPS |
| --- | --- | --- |
| Direct HTTP on a bounded trusted network | `false` | `false` |
| HTTPS at a trusted reverse proxy | `true` | `true` |
| Direct HTTPS through separately managed TLS termination | `false` | `true` |

Forwarded headers are trusted only in the documented private-gateway topology. The outer proxy must replace client-supplied `Host`, `X-Forwarded-Proto` and `X-Forwarded-For`; the built-in gateway replaces its own intermediary headers before calling the unpublished API. `FYLKREN_FORWARDED_HEADER_LIMIT` is `1` for the built-in gateway and `2` when one additional trusted outer proxy is present and direct origin access is blocked. Other values are rejected. Bind the origin to loopback for a same-host proxy or restrict it by firewall to the proxy address.

HTTPS mode uses Secure `__Host-` cookies, HSTS and redirect behavior. Changing mode invalidates existing browser sessions but not accounts. The outer proxy must preserve or strengthen CSP, content-type, framing, referrer and permissions headers.

## Configuration

`deploy/compose/install.sh` creates `.env` once and never changes an existing environment. The supported Compose topology uses an installation-issued API client certificate for PostgreSQL authentication and stores no database password. An obsolete `FYLKREN_DB_PASSWORD` entry in an upgraded `.env` is ignored and may be removed after the upgraded installation and matched restore procedure pass.

Core environment settings include public origin, proxy/HTTPS mode and the remaining startup-only security switches. Language, IANA time zone, clock format, measurement system, classifications, SMTP, notification templates, appearance and identity-provider settings are managed in Platform Manager and stored in the database rather than maintained as repeated `.env` lists. Legacy language and time-zone values are imported only when the regional-settings record is first created.

Local authentication stays enabled until an external provider has been configured, identities linked and an administrative login tested. Invalid startup-critical origins or authentication settings stop startup with a clear error. Invalid regional changes are rejected by the administration API without replacing the current settings.

## Offline operation

Core application, administration, authentication, localization, search, backup and operation work without internet, telemetry or cloud services. Runtime assets, fonts, scripts and language files ship with the installation. External identity, SMTP and integrations are optional adapters to operator-provided services.

Connected automatic updaters such as Watchtower are not part of the supported Fylkren lifecycle and must not indiscriminately restart the stack. Updates follow the controlled procedure in `INSTALLATION_AND_UPGRADES.md`.

## Operational visibility

Platform Manager sees API version, environment, uptime, process memory and database connectivity. The optional, maintained [host-status integration](HOST_STATUS.md) adds disk capacity, the last explicitly recorded complete backup set, container health and restart counts through a bounded read-only snapshot; the API never receives the Docker socket. A bounded in-memory window retains the latest 300 warnings/errors from the current process and supports safe filtering. It resets on restart and is not a durable log store.

Technical logs must not contain credentials, tokens, cookies, configuration secrets or operational document content. A missing or stale host snapshot is shown as unavailable rather than inferred. Windows Server and Hyper-V capacity remain the responsibility of the host monitoring system outside the Linux VM.

## Backup and restore

Disaster recovery covers PostgreSQL, `.env`, Data Protection keys and identity/configuration state as one consistent restore point. Internal transport identities are installation runtime material regenerated by the fenced initializer, while PostgreSQL accepts only the resulting API client identity. Backups work offline and are a Platform Manager operational responsibility. Restore is tested regularly on a separate target.

Site export is a future portability mechanism, not backup. It must preserve durable IDs and references and must stop on identity conflicts rather than silently rewrite history.

See `SYSTEM_REQUIREMENTS.md` for initial capacity profiles and `SERVER_SETUP.md` for detailed server configuration.
