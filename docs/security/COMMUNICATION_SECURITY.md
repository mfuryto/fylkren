# Communication security inventory

This is the authoritative inventory of Fylkren communication paths. New listeners, outbound destinations or service links must be added here and to the source reconciliation before release.

| Path | Direction and data | Authentication | Transport and trust | Destination control |
|---|---|---|---|---|
| Browser or machine client → public gateway | Inbound UI/API, credentials and operational content | Session/CSRF or scoped machine credential | Publicly trusted HTTPS; TLS 1.2/1.3; HTTP only redirects browser navigation and rejects API/callback traffic | Canonical Host and public origin |
| Gateway → API | Internal HTTP API traffic | Private Docker network; original authenticated request is evaluated by API | Plain HTTP/1 on the Compose frontend network | Fixed Compose service `api:8080` |
| API → PostgreSQL | Internal application data and secrets | Dedicated non-default database account/password | Plain PostgreSQL on the Compose internal backend network | Fixed Compose service `postgres:5432` |
| Container health checks | Local/internal health status only | Network/process boundary | Local HTTP; no credentials or customer content | Fixed loopback/service health endpoint |
| Host-status collector → API | Deployment health/backup metadata | Read-only file mount | Local filesystem | Fixed `/run/fylkren-host-status/host-status.json` |
| API → OIDC/SAML provider | Metadata, authorization/token protocol and signed identity assertions | Client secret where applicable; signed provider tokens/assertions | HTTPS with chain/hostname validation and no plaintext fallback | Exact configured origin plus deployment-owned additional identity origins |
| API → webhook receiver | Signed domain-event subset | Per-subscription HMAC secret | HTTPS with chain/hostname validation | Exact administrator-configured URL, DNS/special-address/redirect controls |
| API ↔ federation peer | Signed federation messages and bounded operational payloads | Pinned peer signing keys | HTTPS with chain/hostname validation | Approved peer base URL, exact instance/site grants and outbound policy |
| API → SMTP relay | Notification content and optional relay credential | Optional dedicated SMTP account | Required STARTTLS is fail-closed; explicit plaintext mode is supported only for a deployment-approved trusted internal relay | One Platform Manager-configured host/port with DNS preflight; native DNS rebinding remains SV-068 |
| API → AD/LDAP | Login bind and directory attributes | Dedicated bind/user credentials | LDAPS or StartTLS with chain/hostname validation and no credential-bearing plaintext bind | One configured host/port with DNS preflight; native DNS rebinding remains SV-068 |
| Administrator → host | Deployment management, backups and updates | Host-owned individual SSH access | Deployment-owned SSH policy | Outside application runtime; release evidence must verify the server configuration |
| Backup transfer | Database, environment and Data Protection key archive | Backup-custodian access | Deployment-approved encrypted off-host channel/storage | Operator-selected approved backup destination |

## Current internal-transport gap

SV-103 tracks that the supported single-host Compose topology relies on isolated Docker networks but does not encrypt gateway-to-API or API-to-PostgreSQL traffic. Explicit plaintext SMTP to a trusted internal relay is also supported. Network isolation and least-privilege accounts reduce exposure but do not satisfy ASVS 12.3.1/12.3.3, which require encrypted transport for every service connection. Do not treat the public HTTPS result as evidence for these internal links.

All TLS clients use maintained platform validation. Fylkren does not install a global certificate-bypass callback. Test-only private certificate authorities exist only in disposable laboratory Compose projects and are mounted into their test containers.
