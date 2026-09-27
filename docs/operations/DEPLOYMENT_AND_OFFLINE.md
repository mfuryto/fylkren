# Deployment and offline operation

## Supported topology

The supported deployment is a single-node Docker Compose stack:

```text
web gateway → API → PostgreSQL
```

Web and API run without Linux capabilities, with read-only root filesystems, explicit temporary filesystems and `no-new-privileges`. Runtime processes are non-root. PostgreSQL is available only on the private backend network; the web container cannot connect directly to it.

The gateway becomes available only after the API health check succeeds. API and PostgreSQL ports are not published as public application endpoints.

Linux and Windows hosts may run the same Linux-container stack. Users access it through a modern browser on Windows, Linux or macOS. Direct non-container deployment is architecturally possible but is not the primary maintained installation path.

The current Compose profile is not redundant. Customers requiring high availability need a separately assessed deployment architecture; no multi-node Fylkren profile is currently planned or supported. Instance federation connects independent installations and does not provide automatic failover or database replication.

## Public origin, HTTPS and proxies

`FYLKREN_PUBLIC_URL` is the canonical origin used for authentication, permalinks, email links and Host validation. It contains scheme, hostname and optional port only.

| Mode | Trust forwarded headers | Require HTTPS |
| --- | --- | --- |
| Direct HTTP on a bounded trusted network | `false` | `false` |
| HTTPS at a trusted reverse proxy | `true` | `true` |
| Direct HTTPS through separately managed TLS termination | `false` | `true` |

Forwarded headers are trusted only in the documented private-gateway topology. `FYLKREN_FORWARDED_HEADER_LIMIT` is `1` for the built-in gateway and `2` when one additional trusted outer proxy is present and direct origin access is blocked. Other values are rejected.

HTTPS mode uses Secure `__Host-` cookies, HSTS and redirect behavior. Changing mode invalidates existing browser sessions but not accounts. The outer proxy must preserve or strengthen CSP, content-type, framing, referrer and permissions headers.

## Configuration

`deploy/compose/install.sh` creates `.env` once and generates `FYLKREN_DB_PASSWORD`; it never changes an existing environment. Compose refuses an empty database password.

Core environment settings include public origin, proxy/HTTPS mode, default language, IANA timezone and authentication switches. Classifications, SMTP, notification templates, appearance and identity-provider settings managed in Platform Manager are stored through the application rather than maintained as repeated `.env` lists.

Local authentication stays enabled until an external provider has been configured, identities linked and an administrative login tested. Invalid startup-critical origins, language/timezone or authentication settings stop startup with a clear error.

## Offline operation

Core application, administration, authentication, localization, search, backup and operation work without internet, telemetry or cloud services. Runtime assets, fonts, scripts and language files ship with the installation. External identity, SMTP and integrations are optional adapters to operator-provided services.

Connected automatic updaters such as Watchtower are not part of the supported Fylkren lifecycle and must not indiscriminately restart the stack. Updates follow the controlled procedure in `INSTALLATION_AND_UPGRADES.md`.

## Operational visibility

Platform Manager sees API version, environment, uptime, process memory and database connectivity. A bounded in-memory window retains the latest 300 warnings/errors from the current process and supports safe filtering. It resets on restart and is not a durable log store.

Technical logs must not contain credentials, tokens, cookies, configuration secrets or operational document content. Host disk, backup age, container restart count and service-manager data require an explicitly authorized future host integration and are not inferred by the application.

## Backup and restore

Disaster recovery covers PostgreSQL, `.env`, Data Protection keys and identity/configuration state as one consistent restore point. Backups work offline and are a Platform Manager operational responsibility. Restore is tested regularly on a separate target.

Site export is a future portability mechanism, not backup. It must preserve durable IDs and references and must stop on identity conflicts rather than silently rewrite history.

See `SYSTEM_REQUIREMENTS.md` for initial capacity profiles and `SERVER_SETUP.md` for detailed server configuration.
