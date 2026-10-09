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

The outer proxy must allow request bodies of at least 9 MiB so the supported 8 MiB primary-document import plus multipart overhead reaches Fylkren. In Nginx Proxy Manager, add `client_max_body_size 9m;` under the proxy host's advanced configuration. A smaller outer limit returns the proxy's error before Fylkren can validate the document or provide an application error.

## Configuration

`deploy/compose/install.sh` creates `.env` once and never changes an existing environment. The supported Compose topology uses an installation-issued API client certificate for PostgreSQL authentication and stores no database password. An obsolete `FYLKREN_DB_PASSWORD` entry in an upgraded `.env` is ignored and may be removed after the upgraded installation and matched restore procedure pass.

Core environment settings include public origin, proxy/HTTPS mode and the remaining startup-only security switches. Language, IANA time zone, clock format, measurement system, classifications, SMTP, notification templates, appearance and identity-provider settings are managed in Platform Manager and stored in the database rather than maintained as repeated `.env` lists. Legacy language and time-zone values are imported only when the regional-settings record is first created.

Local authentication stays enabled until an external provider has been configured, identities linked and an administrative login tested. Invalid startup-critical origins or authentication settings stop startup with a clear error. Invalid regional changes are rejected by the administration API without replacing the current settings.

## Offline operation

Core application, administration, authentication, localization, search, backup and operation work without internet, telemetry or cloud services. Runtime assets, fonts, scripts and language files ship with the installation. External identity, SMTP and integrations are optional adapters to operator-provided services.

Connected automatic updaters such as Watchtower are not part of the supported Fylkren lifecycle and must not indiscriminately restart the stack. Updates follow the controlled procedure in `INSTALLATION_AND_UPGRADES.md`.

### Internal services for an air-gapped network

Fylkren has no mandatory vendor, activation, telemetry, CDN, public DNS or cloud connection at runtime. An air-gapped installation must provide the infrastructure below inside its own security boundary. A service marked as feature-dependent is unnecessary when that feature is disabled.

| Internal capability | When it is required | Air-gapped requirement |
| --- | --- | --- |
| Name resolution | Required unless every client and service uses controlled static host entries | Resolve the canonical Fylkren hostname and every enabled internal integration consistently. DNS must not forward unresolved names outside the security boundary. |
| Trusted time | Required for qualified operation | Provide an approved internal NTP source. The host, reverse proxy, API, PostgreSQL, identity providers, federation peers and log collector must use correlated time. Fylkren treats an unavailable or excessive offset as unhealthy. |
| Browser-trusted TLS identity | Required for HTTPS | Issue the public Fylkren origin certificate from an internal PKI trusted by every managed client, or import an approved certificate through the deployment's TLS terminator. The Compose stack creates its separate API/PostgreSQL transport identities locally. |
| Backup storage and restore target | Required for production operation | Store matched database, environment, Data Protection key-ring and custody backups away from the active database disk. Provide a separate fenced target for restore rehearsals. Neither target needs internet access. |
| Security-log collector | Required for the qualified production logging boundary | Run a logically separate collector inside the isolated network and accept the host journal through HTTPS with mutual TLS. A second container or volume on the Fylkren host does not satisfy this boundary. |
| SMTP relay | Required only for email notifications | Use an internal relay with STARTTLS and an internally trusted certificate. Without SMTP, domain actions still complete and delivery obligations remain visible for operational handling. |
| AD or LDAP directory | Required only when directory authentication or personnel import is enabled | Provide reachable internal AD/LDAP with stable identifiers, lifecycle data, DNS and trusted LDAPS or LDAP StartTLS. Local accounts remain available without a directory. |
| OIDC or SAML provider | Required only when single sign-on is enabled | Host the provider, metadata, signing keys and browser endpoints inside the isolated network. Managed clients and the Fylkren API must reach the configured internal names. |
| AI provider | Required only when Enterprise AI assistance is enabled | Operate an approved OpenAI-compatible endpoint internally. AI is disabled by default, and every ordinary Fylkren function remains available without it. |
| Federation peer | Required only for cross-instance federation | Each trusted Fylkren peer and its HTTPS identity must be reachable inside the permitted network segment. Federation is not required for work between Sites in one installation. |
| Internal artifact staging or registry | Required only for installation and updates | Transfer the approved source/images, hashes, SBOMs, license and release notes through the organization's controlled media process. A local container registry is optional; preloaded images are sufficient. Runtime operation never pulls images automatically. |

Local passwords, TOTP, recovery codes and locally managed WebAuthn authenticators work without an identity provider. Enterprise entitlement uses an imported signed offline license and has no activation service. The user interface makes no runtime request for external fonts, scripts, language packs or documentation.

### Network-flow baseline

The firewall should deny general internet egress. Permit only the flows used by the selected internal services:

| Source | Destination | Purpose |
| --- | --- | --- |
| Managed browser | Fylkren origin | HTTPS user interface and API |
| Managed browser | Configured internal OIDC or SAML provider | Interactive single sign-on when enabled |
| Fylkren host | Internal DNS and NTP | Name resolution and trusted time |
| Fylkren API | Configured SMTP, directory, identity, AI and federation services | Enabled feature traffic only; exact destinations are administrator-controlled |
| Fylkren host | Separate log collector | Journal forwarding over HTTPS with mutual TLS |
| Backup process | Approved backup target | Matched backup transfer and recovery rehearsal |
| Administrator-controlled staging host or media | Fylkren host | Deliberate installation, license and update import |

Ports are deployment-owned because SMTP, directory, identity, AI, logging, backup and federation endpoints are configurable. Record exact source, destination, protocol, port, certificate authority and owner in the installation's firewall baseline. Do not add a default internet route merely to make an optional integration work.

The current controlled update procedure supports offline transfer, but versioned signed air-gap release bundles with a dedicated offline verifier remain future distribution work. Until that is delivered, the operator must preserve hashes, SBOMs and transfer approval for every imported candidate and verify it before installation.

## Operational visibility

Platform Manager sees API version, environment, uptime, process memory and database connectivity. The optional, maintained [host-status integration](HOST_STATUS.md) adds disk capacity, the last explicitly recorded complete backup set, container health and restart counts through a bounded read-only snapshot; the API never receives the Docker socket. A bounded in-memory window retains the latest 300 warnings/errors from the current process and supports safe filtering. It resets on restart and is not a durable log store.

Technical logs must not contain credentials, tokens, cookies, configuration secrets or operational document content. A missing or stale host snapshot is shown as unavailable rather than inferred. Windows Server and Hyper-V capacity remain the responsibility of the host monitoring system outside the Linux VM.

## Backup and restore

Disaster recovery covers PostgreSQL, `.env`, Data Protection keys and identity/configuration state as one consistent restore point. Internal transport identities are installation runtime material regenerated by the fenced initializer, while PostgreSQL accepts only the resulting API client identity. Backups work offline and are a Platform Manager operational responsibility. Restore is tested regularly on a separate target.

Site export is a future portability mechanism, not backup. It must preserve durable IDs and references and must stop on identity conflicts rather than silently rewrite history.

See `SYSTEM_REQUIREMENTS.md` for initial capacity profiles and `SERVER_SETUP.md` for detailed server configuration.
