# Communication security inventory

This is the authoritative inventory of Fylkren communication paths. New listeners, outbound destinations or service links must be added here and to the source reconciliation before release.

| Path | Direction and data | Authentication | Transport and trust | Destination control |
|---|---|---|---|---|
| Browser or machine client → public gateway | Inbound UI/API, credentials and operational content | Session/CSRF or scoped machine credential | Publicly trusted HTTPS; TLS 1.2/1.3; HTTP only redirects browser navigation and rejects API/callback traffic | Canonical Host and public origin |
| Gateway → API | Internal HTTP API traffic | Private Docker network; original authenticated request is evaluated by API | TLS 1.2/1.3 with exact trust in the installation CA and the `api` service certificate | Fixed Compose service `api:8443` |
| API → PostgreSQL | Internal application data and secrets | Installation-issued `fylkren-api` client certificate mapped only to the dedicated `fylkren` database role | TLS 1.2/1.3 with `VerifyFull`, exact installation-CA trust and the `postgres` service name; plaintext and certificate-less network access are rejected | Fixed Compose service `postgres:5432` |
| Container health checks | Local/internal health status only | Network/process boundary | Local HTTP; no credentials or customer content | Fixed loopback/service health endpoint |
| Host-status collector → API | Deployment health/backup metadata | Read-only file mount | Local filesystem | Fixed `/run/fylkren-host-status/host-status.json` |
| API → OIDC/SAML provider | Metadata, authorization/token protocol and signed identity assertions | Client secret where applicable; signed provider tokens/assertions | HTTPS with chain/hostname validation and no plaintext fallback | Exact configured origin plus deployment-owned additional identity origins |
| API → webhook receiver | Signed domain-event subset | Per-subscription HMAC secret | HTTPS with chain/hostname validation | Exact administrator-configured URL, DNS/special-address/redirect controls |
| API ↔ federation peer | Signed federation messages and bounded operational payloads | Pinned peer signing keys | HTTPS with chain/hostname validation | Approved peer base URL, exact instance/site grants and outbound policy |
| API → SMTP relay | Notification content and optional relay credential | Optional dedicated SMTP account | Required STARTTLS is fail-closed; plaintext delivery is rejected | One Platform Manager-configured host/port; one approved DNS result set is connected directly and TLS validates the configured host |
| API → AD/LDAP | Login bind and directory attributes | Dedicated bind/user credentials | LDAPS or StartTLS with chain/hostname validation and no credential-bearing plaintext bind | One configured host/port; only preflight-approved addresses are eligible for the actual connection |
| API → configured AI provider | Selected task context and bounded prompts; generated suggestion response | Optional purpose-protected provider API key | HTTPS with platform chain/hostname validation, no redirects, 300-second timeout and 2 MB response limit | One Platform Manager-configured full endpoint; checked DNS/special-address controls, with private origins requiring an exact deployment-owned exception |
| Administrator → host | Deployment management, backups and updates | Host-owned individual SSH access | Deployment-owned SSH policy | Outside application runtime; release evidence must verify the server configuration |
| Backup transfer | Database, environment and Data Protection key archive | Backup-custodian access | Deployment-approved encrypted off-host channel/storage | Operator-selected approved backup destination |

## Internal transport certificates

The supported Compose topology creates one installation-specific internal CA, separate P-256 server keys for API and PostgreSQL, and a separate P-256 database-client key for API before either service starts. The CA, public trust, server keys and client key use separate Docker volumes. Runtime services receive only the keys required for their role and the public trust anchor; the gateway cannot read either API key, PostgreSQL cannot read the client key, API cannot read the PostgreSQL key and no runtime service receives the CA key. Certificates are renewed before their final 30 days whenever the Compose initialization service runs. Restart all services together after renewal so every process loads the same generation.

Gateway verification is fixed to the `api` service name. Npgsql uses `VerifyFull` for `postgres` and presents the `fylkren-api` client certificate. PostgreSQL rejects every non-TLS or certificate-less network connection and maps only that certificate identity to the application role; local container maintenance continues over its Unix socket. SMTP requires STARTTLS; a legacy saved plaintext setting is displayed but delivery and saving remain blocked until an administrator selects STARTTLS. SV-103 was closed by current-image positive and negative TLS tests plus backup/restore rehearsal.

All TLS clients use maintained platform validation. Fylkren does not install a global certificate-bypass callback. Test-only private certificate authorities exist only in disposable laboratory Compose projects and are mounted into their test containers.
