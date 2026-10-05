# Secure development and dependency policy

## Dependency remediation targets

The maintainer triages a newly reported dependency vulnerability within one business day. The target for an available, compatible fix is 72 hours for Critical, 14 days for High, 60 days for Medium and 180 days for Low severity. Active exploitation, exposed attack surface and compensating controls can shorten these targets. An exception must record the affected version, exposure, compensating controls, owner, review date and acceptance authority in the finding register. A release cannot exceed these targets silently.

JavaScript and .NET lock/central package files are authoritative inputs, and container base images are explicit in Dockerfiles. Repository and image scans are release gates. SV-106 records that Fylkren does not yet produce and retain one release-candidate SBOM that also identifies operating-system packages and their relationship to the shipped images.

## Resource-demand inventory

| Function | Bound and defense |
| --- | --- |
| Authentication and credential verification | Separate fixed-window rate limit, bounded password/KDF input, account failure threshold and lockout |
| API mutation and machine clients | Global write limiter plus machine-client throttling, scopes, expiry and revocation |
| Upload/import/image decoding | Gateway/API body ceilings, one concurrent portability validation, entry/unpacked-size limits, decoded pixel limits and bounded temporary filesystems |
| Export/report/PDF | Authorized scope, pagination/package limits and client-side print generation |
| Search, lists, timelines and audit | Bounded page sizes, indexed queries and server-side filtering; navigation counts use database aggregates |
| Outbound HTTP, federation and webhooks | Exact destinations, timeouts, response-size limits, redirect rejection where required, leases and bounded retries |
| SMTP and directory | Explicit destinations, connection/DNS timeouts, bounded query/result sizes and background batch limits |
| Background notifications, lifecycle and federation | Bounded batches, leases, terminal retry states and cancellation tokens |

Maintained load, parser, upload, integration and rate-limit tests qualify these limits. Deployment sizing against the exact release candidate remains a final gate.

## Defensive coding boundary

- Minimal API handlers bind typed request records and return explicit response projections; entities are not blindly updated from client objects.
- Outbound clients disable automatic redirects or reject redirects at the bounded handler where the protocol requires exact destinations.
- Forwarded headers are accepted only when explicitly enabled and from configured trusted proxy networks/addresses; canonical host validation follows them.
- C# and TypeScript provide typed application boundaries. JSON deserialization targets explicit records; polymorphic client type markers are ignored.
- Production web code has no unsafe recursive object merge or dynamic assignment of untrusted property names. HTTP parameters bind to named typed handler values; unknown values do not alter command objects.
- Test-only federation endpoints exist only in the `FederationTest` environment, and test/laboratory assets are absent from runtime images.

New dependency sources, interpreters, recursive merge utilities, generic entity binders, redirect-following clients or resource-heavy functions require an update to this inventory and focused tests.
