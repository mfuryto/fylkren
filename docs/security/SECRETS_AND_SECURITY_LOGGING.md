# Secrets and security logging

This document is the canonical inventory for authentication secrets, cryptographic key material, and security-event logging. It applies to connected and air-gapped installations.

## Secret inventory

| Secret | Generation and storage | Protection and lifecycle |
| --- | --- | --- |
| Local passwords | Chosen by the user and stored only as ASP.NET Identity PBKDF2 hashes with a 220,000-iteration configuration | Passwords are never recoverable. A local, bundled compromised-password policy is applied without an internet lookup. |
| Activation and reset codes | 128 random bits from the operating-system CSPRNG; only a SHA-256 digest is stored | Shown once, valid for 30 minutes, single use, and superseded by a newly issued code. Successful reset increments the identity security version and invalidates older sessions during revalidation. |
| TOTP secrets and recovery codes | TOTP secrets are generated locally; recovery codes are generated locally and stored as digests | TOTP secrets are protected with ASP.NET Data Protection. Recovery codes are one-time values. Neither value may be written to logs. |
| Passkeys/WebAuthn | Private key remains on the authenticator; the platform stores the public credential and counter | WebAuthn challenge state is protected with ASP.NET Data Protection and has a short lifetime. |
| Browser sessions | Encrypted and authenticated cookie tickets | `HttpOnly`, `SameSite=Strict`, secure-only under HTTPS, one-hour inactivity lifetime and twelve-hour absolute lifetime. Data Protection keys are persisted outside the container image. |
| Machine API signing keys | Client-specific P-256 private key generated from the operating-system CSPRNG; only the public key is stored | Shown once. Each request signs method, target, timestamp, nonce and body hash. Rotation uses an overlapping new client followed by deactivation of the old client. |
| SMTP password | Entered by Platform Manager and stored in the database | Protected with ASP.NET Data Protection. It is never returned by the API after storage. |
| Database service identity | Installation-specific client-only P-256 certificate created by the networkless TLS initializer and mounted only into API | PostgreSQL verifies the installation CA and maps only `fylkren-api` to the dedicated database role. The supported Compose path has no database password. |
| OIDC, AD and LDAP credentials | Entered and tested by Platform Manager; the steady-state Compose environment accepts no provider secret | Purpose-protected with ASP.NET Data Protection in PostgreSQL and never returned after storage. |
| Data Protection key ring and custody | Framework keys persist in a dedicated volume; a separate installation-owned RSA-3072 custody key wraps every key XML using RSA-OAEP-SHA-256 and AES-256-GCM | Only the API has steady-state read-only custody access. A networkless one-shot initializer migrates older plaintext key XML. Database, key ring and custody are backed up and restored as one checksummed set; loss or premature destruction makes protected data unavailable. |
| Federation signing private key | Generated locally as a dedicated P-256 key; protected PKCS#8 is stored in the database | Protected by the Data Protection key ring and never returned. Database and key ring must be restored together. Peers pin the first public SPKI fingerprint out of band. Planned rotation uses automatic two-phase old/new-key proof and signed peer receipts. Confirmed key loss can create a replacement only after the old key fails to load; each peer must directly discover and explicitly approve its independently compared fingerprint, which suspends that peer's catalog and grants until reactivated. |

## Security-event logging

| Layer | Events and metadata | Destination and access |
| --- | --- | --- |
| Gateway/container | HTTP/service startup, proxy and runtime failures with container/host time | `journald` container driver; optional authenticated HTTPS/mTLS forwarding to the deployment's logically separate collector |
| API technical | Structured authentication outcome, authorization denial, machine-auth rejection, worker/integration failure and unexpected exception; event ID, category, UTC time, route/method/status, actor where known and trace ID as applicable | Structured console provider, bounded Platform Manager warning view and, when enabled, the remote journal collector |
| Security audit | Administrative and significant operational commands with event ID, UTC timestamp, actor, Site, object/type and correlation/request identifiers | Append-only PostgreSQL records; authorized Site/Platform Manager read projections |
| Domain activity | Significant domain facts and source/origin/correlation metadata | PostgreSQL activity store; object/Site authorization applies |
| External delivery | Notification, webhook and federation delivery state, attempts and bounded error/status data | PostgreSQL delivery records plus sanitized worker logs |

Application log destinations are the standard structured console provider, the explicitly bounded in-process Platform Manager view and the documented PostgreSQL audit/activity/delivery stores. The supported Compose services always use the `journald` logging driver. A deployment can optionally configure `systemd-journal-upload` to forward the persistent journal over HTTPS with a client certificate and exact trusted CA; its durable cursor advances only after the receiver acknowledges entries. For deployments selecting this control, the verifier requires an active uploader, mTLS material, mode-0600 private key, journald on every long-running container and acknowledged cursor progress. The collector then owns analysis, detection, alerting, escalation and retention under customer policy.

The API emits structured events for successful authentication and for every API response ending in HTTP 401 or 403. Rejected events include only the HTTP method, matched route template, status, an internal person identifier when an authenticated actor exists, and the request trace identifier. They do not include request or response bodies, query strings, usernames, email addresses, passwords, reset codes, TOTP values, cookies, or tokens.

The in-process Platform Manager log is deliberately bounded to 300 warning-or-higher entries and 2,000 characters per entry. A central sanitizer removes authorization and cookie headers, bearer tokens, URI credentials, named passwords, client secrets, API keys, TOTP secrets, reset/activation/recovery codes, sensitive query values, and control characters that could forge log lines. Production retention and forwarding beyond this bounded operational view belong to the deployment's logging platform.

All application timestamps use UTC and containers share the host kernel clock. The maintained host collector reports NTP synchronization, source, current offset and a 1,000 ms health boundary in Platform Manager. The correlation verifier fails unless the host is healthy and gateway, API and PostgreSQL remain within two seconds of one another. Galileo production evidence on 2026-10-05 showed chrony `Normal`, a 0.126048 ms last offset and the healthy 1,000 ms application boundary. SV-107 is closed with this deployment evidence and the repeatable correlation check. SV-108 is closed at the product implementation boundary by the optional journald-to-remote HTTPS/mTLS path and acknowledgement verifier. A deployment that omits it records an approved exception and does not claim ASVS 16.4.3.

Successful authentication is emitted at `Information`. An anonymous `GET` or `HEAD` rejected with 401 is also emitted at `Information`: this commonly occurs when a restored browser tab or expired session reads a protected view, and it must not appear as a service fault in Platform Manager. Authenticated 401/403 responses and anonymous state-changing attempts remain `Warning`. Gateway access logs still retain the request outcome independently. Unexpected exceptions remain handled by the platform exception handler and are recorded without returning implementation details to the client.

Security audit records remain separate from domain/activity facts. Covered WorkItem commands correlate the two by event and operation IDs without copying task text into activity metadata. Federation transport housekeeping no longer removes security audit using the protocol retention duration. No replacement security-audit store or new audit purge policy is introduced. Customer-defined audit retention and deployment collector controls remain future configuration. See the [activity/lifecycle architecture](../architecture/EVENT_ACTIVITY_AND_INFORMATION_LIFECYCLE.md).

## Operational requirements

- Restrict container logs, the database, backups, `.env`, internal certificate volumes and the Data Protection key volume to authorized operators.
- Collect logs with synchronized UTC timestamps and preserve the request trace identifier.
- Decide during production qualification whether remote journal forwarding is enabled. If enabled, verify it and monitor `systemd-journal-upload`; if omitted, record the accountable risk exception, review date and local compensating controls and do not claim ASVS 16.4.3.
- Define retention according to the organization's legal and operational requirements; do not retain security logs indefinitely by default.
- Never enable request-body logging on identity, profile, SMTP, or machine-client endpoints.
- Verify database and Data Protection key restore from the same recovery point.
- Run `bash tools/security/verify-repository-safety.sh --history` before every public release.
