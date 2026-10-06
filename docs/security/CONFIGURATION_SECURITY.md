# Configuration and backend service security

This inventory complements the communication and cryptographic inventories. It defines the supported production service identities, secret custody and exposed runtime surface.

## Backend identities

| Consumer | Service | Identity and privilege | Lifetime and replacement |
|---|---|---|---|
| API | PostgreSQL | Exact `postgres` server identity and exact `fylkren-api` client identity verified against the installation CA; the client certificate maps only to the dedicated `fylkren` database owner | Separate server/client certificates are renewed by the fenced TLS initializer; no database password exists in the supported Compose path |
| Gateway | API | Exact `api` server identity verified against the installation CA. End-user/session or machine authorization is enforced by the API | Server certificate is renewed by the fenced TLS initializer; no separate gateway client credential |
| Machine integration | Administration/report API | Individually named client, explicit scope allowlist, expiry of at most 366 days, request-bound P-256 proof, five-minute replay window and revocation | Private signing key held by the integration; create replacement and deactivate old client |
| API | OIDC token endpoint | Per-installation client ID/secret protected in PostgreSQL | Replace through Platform Manager/provider |
| API | SMTP or AD/LDAP | Dedicated configured integration credential protected in PostgreSQL | Replace through Platform Manager/service owner |
| Federation peer | Federation API | Pinned per-installation signing key plus exact grants | Two-phase key rotation or explicit lost-key recovery |

External machine integrations now use request-bound `signed-v2` proof with a client-specific P-256 key, five-minute timestamp window and database-backed nonce uniqueness. New Bearer credentials cannot be issued. Existing `bearer-v1` clients retain a bounded compatibility overlap only until the earlier of their existing expiry and 2027-01-04 23:59:59 UTC. PostgreSQL uses a separately scoped client certificate, exact CA verification and an explicit certificate-to-role map. SV-104 is closed with issuance, expiry, revocation, replay, scope and retirement evidence.

## Secret custody

Application-held recoverable secrets use purpose-specific ASP.NET Data Protection. The key ring is mounted only into the API. OIDC, SMTP and directory credentials are never returned after storage; federation private keys, TOTP secrets and webhook secrets have their separately documented boundaries. Machine secrets and passwords have only salted verifiers.

The supported Compose path has no database password. Its Data Protection key ring remains in a mode-0700 Docker volume with mode-0600 matched backup archives; internal certificate private keys use separate least-privilege volumes. SV-105 now tracks the remaining local Data Protection and integration-secret custody rather than a unified secrets service with independently enforced access and destruction. The repository and built images contain no production private key or credential.

## Production runtime surface

- API is published in Release mode; web assets are a production build. No Swagger/OpenAPI UI or developer exception page is registered.
- Runtime images copy published API output or web `dist`, not the repository or `.git` metadata.
- Nginx directory listing is disabled and TRACE is rejected.
- The public health endpoint is intentionally minimal. Host status, audit, platform configuration and administration endpoints require authorization.
- Unknown browser routes may return the SPA shell; a `200 text/html` for `/.git/config` or `/swagger` is not repository/API documentation content. Static directory requests return `403`.
- Test fixtures, synthetic credentials and laboratory certificate authorities are not copied into production images.
