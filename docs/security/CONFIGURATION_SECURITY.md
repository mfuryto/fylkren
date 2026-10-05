# Configuration and backend service security

This inventory complements the communication and cryptographic inventories. It defines the supported production service identities, secret custody and exposed runtime surface.

## Backend identities

| Consumer | Service | Identity and privilege | Lifetime and replacement |
|---|---|---|---|
| API | PostgreSQL | Exact `postgres` server identity verified against the installation CA; dedicated randomly passworded `fylkren` database owner on the internal backend network | Server certificate is renewed by the fenced TLS initializer; the long-lived client secret remains in owner-only `.env` and requires a coordinated database/configuration change |
| Gateway | API | Exact `api` server identity verified against the installation CA. End-user/session or machine authorization is enforced by the API | Server certificate is renewed by the fenced TLS initializer; no separate gateway client credential |
| Machine integration | Administration/report API | Individually named client, explicit scope allowlist, expiry of at most 366 days, hashed secret and revocation | Long-lived random bearer secret; create replacement and deactivate old client |
| API | OIDC token endpoint | Per-installation client ID/secret protected in PostgreSQL | Replace through Platform Manager/provider |
| API | SMTP or AD/LDAP | Dedicated configured integration credential protected in PostgreSQL | Replace through Platform Manager/service owner |
| Federation peer | Federation API | Pinned per-installation signing key plus exact grants | Two-phase key rotation or explicit lost-key recovery |

SV-104 tracks that PostgreSQL client access and machine integrations use long-lived bearer/password credentials rather than short-term tokens or certificate-bound client identities. Internal server certificates now authenticate the PostgreSQL and API endpoints, but do not replace those client credentials. Their randomness, scoping, isolation, expiry/revocation and hashing reduce exposure but do not meet ASVS 13.2.1's stated credential model.

## Secret custody

Application-held recoverable secrets use purpose-specific ASP.NET Data Protection. The key ring is mounted only into the API. OIDC, SMTP and directory credentials are never returned after storage; federation private keys, TOTP secrets and webhook secrets have their separately documented boundaries. Machine secrets and passwords have only salted verifiers.

The installation database password remains in a mode-0600 `.env`, and the Data Protection key ring remains in a mode-0700 Docker volume with mode-0600 backup archives. SV-105 tracks that this is local file/volume custody rather than a unified secret-management service with centrally enforced creation, access, rotation and destruction. The repository and built images contain no production private key or credential.

## Production runtime surface

- API is published in Release mode; web assets are a production build. No Swagger/OpenAPI UI or developer exception page is registered.
- Runtime images copy published API output or web `dist`, not the repository or `.git` metadata.
- Nginx directory listing is disabled and TRACE is rejected.
- The public health endpoint is intentionally minimal. Host status, audit, platform configuration and administration endpoints require authorization.
- Unknown browser routes may return the SPA shell; a `200 text/html` for `/.git/config` or `/swagger` is not repository/API documentation content. Static directory requests return `403`.
- Test fixtures, synthetic credentials and laboratory certificate authorities are not copied into production images.
