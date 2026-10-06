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

Application-held recoverable secrets use purpose-specific ASP.NET Data Protection. At steady state, the key ring and its RSA-3072 key-encryption custody are mounted read-only only into the API; a networkless one-shot initializer may access the key ring during startup to migrate older plaintext key XML. Every root key is wrapped with RSA-OAEP-SHA-256 and an AES-256-GCM envelope before it reaches the volume. OIDC, SMTP and directory credentials are entered in Platform Manager, protected in PostgreSQL and never returned after storage. Machine credentials and passwords have only non-recoverable verifiers or public verification keys.

The supported Compose path has no database password and accepts no OIDC, AD or LDAP secret through `.env`. The Data Protection key ring and dedicated custody key use separate Docker volumes, separate from PostgreSQL and internal transport identities. The API receives only read-only custody access; the initializer has no network or long-running process. Backup and restore treat database, protected configuration, key ring and custody as one checksummed recovery point. Custody rotation and destruction are controlled operations because destroying the final matching private key permanently destroys access to protected data. SV-105 is closed by the encrypted root-key boundary, least-privilege mounts, fail-closed migration, matched recovery, and tests for confidentiality, tampering and recovery. The repository and built images contain no production private key or credential.

## Production runtime surface

- API is published in Release mode; web assets are a production build. No Swagger/OpenAPI UI or developer exception page is registered.
- Runtime images copy published API output or web `dist`, not the repository or `.git` metadata.
- Nginx directory listing is disabled and TRACE is rejected.
- The public health endpoint is intentionally minimal. Host status, audit, platform configuration and administration endpoints require authorization.
- Unknown browser routes may return the SPA shell; a `200 text/html` for `/.git/config` or `/swagger` is not repository/API documentation content. Static directory requests return `403`.
- Test fixtures, synthetic credentials and laboratory certificate authorities are not copied into production images.
