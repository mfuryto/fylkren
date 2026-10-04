# Security threat model

## Scope and objectives

This model covers the supported single-installation architecture: web gateway, API, PostgreSQL, and persistent Data Protection keys. It includes browser users, Platform Manager, Site Manager, operational roles, machine APIs, identity providers, SMTP, and data crossing site boundaries. The separately maintained [independent-instance federation threat model](FEDERATION_THREAT_MODEL.md) covers the unreleased Enterprise protocol between installations.

Security objectives are to:

- prevent access or action outside the user's site, work level, role, and task relationship;
- preserve sender, receiver, history, classification, reporting, and audit integrity across the complete chain;
- protect passwords, identity links, TOTP secrets, passkeys, API keys, SMTP credentials, and sessions;
- ensure platform operation does not silently grant site-content access and site administration does not grant platform authority;
- maintain availability and bounded performance for large lists, searches, notifications, and concurrent workflows.

## Assets

| Asset | Impact if compromised |
| --- | --- |
| Internal learning and treatment discussion | Disclosure to higher levels or external report recipients, loss of follow-up accountability |
| Tasks, plans, execution, and final reports | Unauthorized disclosure, incorrect direction, or loss of operational traceability |
| Site, level, and role model | Cross-site access or unauthorized decision authority |
| Identities and authenticators | Account takeover or persistent unauthorized access |
| Classification and report export | Incorrect marking or leakage through screen, print, PDF, or API |
| Audit and delivery history | Loss of accountability or concealment of abuse |
| Database and Data Protection keys | Loss of confidentiality, integrity, or ability to decrypt legitimate protected data |
| SMTP and API integrations | Abuse as a trusted sender or bulk extraction/modification |

## Trust boundaries

1. Internet or customer network → HTTPS/reverse proxy → web gateway.
2. Web gateway → API over the isolated frontend network.
3. API → PostgreSQL over the internal backend network.
4. API → SMTP, OIDC, SAML, AD, or LDAP integration boundary.
5. Browser session → site and work-level authorization for every object and action.
6. Bearer token → machine identity → scope → exact site/report grant.
7. Parent/child site or request → explicit work relationship, immutable snapshots, and filtered return data.

## Outbound HTTP integration boundary

A Platform Manager configures webhook URLs, federation peer origins and identity-provider addresses; ordinary domain payloads must not select new transport destinations. All HTTP integration clients use the shared HTTPS-only checked-IP transport. DNS is resolved once per new connection; every returned address must be allowed, and the socket connects to that checked IP while normal hostname/certificate validation remains active. Redirect following and system proxy routing are disabled.

Private network integration origins require exact deployment-owned approval, including port. Approval is separate from OIDC metadata's authority-origin restriction; a distinct JWKS/token/userinfo host requires its own identity-origin approval. Never allow metadata/link-local, multicast or other rejected special-purpose addresses through the private exception. The current source reference is the [IANA IPv4 registry](https://www.iana.org/assignments/iana-ipv4-special-registry/) and [IPv6 registry](https://www.iana.org/assignments/iana-ipv6-special-registry/); ranges require review when those assignments change.

SAML metadata is downloaded and parsed with explicit byte/XML/expiry limits before authentication handler initialization. Metadata signatures are not an independent trust anchor: authenticated HTTPS and the configured exact IdP identity establish metadata trust, and Sustainsys validates response/assertion signatures against its signing keys. Artifact resolution remains disabled to avoid an alternate library network path. Webhooks consume status headers only; federation and identity readers enforce actual byte limits even when Content-Length is absent. See [deployment approvals and compatibility limits](../operations/INSTALLATION_AND_UPGRADES.md#outbound-integration-configuration).

This boundary does not govern SMTP/AD/LDAP sockets. Their configured server/port/DNS/referral controls remain the explicit incomplete scope of ASVS 1.3.6. External provider outages must reject sign-in while preserving existing local administrative access; no new event, audit or notification store is introduced.

SMTP and AD/LDAP destinations are explicit Platform Manager configuration: host/IP and separate port, not a URL or user-selected recipient-domain endpoint. Shared syntax/special-address validation and bounded DNS preflight apply to client preparation; LDAP retains disabled referral chasing and required TLS. Native clients perform another DNS lookup, so checked-IP pinning is not established for these transports. Restricted deployment egress remains an open qualification dependency (SV-068). StartTLS binds only after TLS, and directory referral responses are unavailable rather than authoritative missing-account evidence. See the same [deployment notes](../operations/INSTALLATION_AND_UPGRADES.md#outbound-integration-configuration).

## Actors and assumptions

Threat actors include anonymous users; authenticated users attempting horizontal or vertical escalation; privileged roles acting outside assigned authority; holders of leaked sessions or credentials; compromised or misconfigured identity, mail, or proxy systems; host, volume, backup, or database operators; and accidental misuse such as a wrong recipient or stale identity link.

Supported operation assumes that an origin port is not exposed around the external proxy; `.env`, database, backup, and key volumes are access-controlled; system clocks are trustworthy; and customers securely manage external directories and TLS endpoints.

## Priority abuse cases

| ID | Abuse case | Primary controls | Required verification |
| --- | --- | --- | --- |
| TM-01 | Change a UUID to read or modify another site's object | Central site/level scope and object checks | Authorization matrix and dynamic negative tests |
| TM-02 | Use Platform Manager authority to read site content | Separate platform/site surfaces and explicit operational identity | Negative UI and API tests |
| TM-03 | Use an operational leader role to mutate site administration | Site Manager policy on every administrative mutation | Endpoint/role matrix |
| TM-04 | Retain a session after deletion, deactivation, or transfer | Periodic session revalidation and active-access checks | Before/after lifecycle test |
| TM-05 | Trigger a browser mutation through CSRF | SameSite Strict and central antiforgery middleware | JSON, form, DELETE, and content-type tests |
| TM-06 | Inject script or markup through rich text, links, names, or IdP data | Controlled rendering, URL policy, CSP, sanitization | Stored and reflected injection tests |
| TM-07 | Exploit BOLA/IDOR in administration or report APIs | Machine scope, exact grant, and object authorization | OWASP API tests |
| TM-08 | Leak internal processing through request or parent/child flow | Snapshots, site boundary, and official filtered response | Complete cross-site E2E tests |
| TM-09 | Forge Host or forwarded headers | Allowed-host enforcement, trusted proxy chain, origin checks | Proxy and host tests |
| TM-10 | Leak a secret through logs, audit, or email failure | Central sanitizer and content-minimized records | Dynamic leakage tests |
| TM-11 | Exhaust resources with body, search, pagination, or auth work | Body and query bounds, pagination, rate and concurrency limits | Boundary, concurrency, and load tests |
| TM-12 | Restore a database without matching cryptographic keys | Coordinated database/key-ring backup | Documented restore exercise |
| TM-13 | Remove or rewrite audit/report history during deletion | Historical snapshots, retained anchors, bounded mutation | Integrity and retention tests |
| TM-14 | Accept insecure transport or fail open in SMTP/IdP integration | TLS requirements, fail-closed behavior, visible status | Closed-environment integration tests |
| TM-15 | Replay password-reset, TOTP, recovery, or WebAuthn material | Atomic consumption, identity locks, counters, expiry | Parallel replay tests |
| TM-16 | Abuse a machine key to consume CPU or expand authority | Pre-hash limits, global concurrency cap, least privilege | Distributed invalid-key and scope tests |

## Residual risk

Application controls cannot defend against complete compromise of the Docker host, database administrator, backup administrator, or customer identity provider. Tamper-resistant audit outside the application database, centralized secret management, high availability, and distributed key management require separate customer-operated controls or a separately assessed deployment architecture; they are not guaranteed by the current product. The final security report and deployment requirements must state these boundaries explicitly.

## Internal learning disclosure boundary

Learning points are internal to their reporting work level. Permission to read an approved subordinate report does not grant permission to read the subordinate learning queue or discussion. Creation validates and commits alongside report drafting but stores points in separate tables. Report/approval/forwarding code consumes final-report content rather than these tables. Learning read/comment/treatment endpoints recheck active Site membership and level access; only level leadership treats points, with CSRF and a version token for concurrent changes. Plain-text rendering escapes point/comment content. Administrative audit retains event and task identity without point text. Complete Site portability and database backups include internal learning as privileged recovery data. The [targeted functional/authorization run](../testing/runs/2026-10-02-internal-learning.md) does not replace the wider security verification gate.
