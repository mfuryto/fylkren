# ASVS applicability decisions

This record explains why OWASP ASVS 5.0 Level 2 requirements are marked
`Not applicable` for the supported Fylkren architecture. A requirement is
excluded only when its triggering capability or protocol is absent. A control
is not made non-applicable merely because another control reduces its risk.

If a future release introduces a capability listed below, every associated
requirement must be reopened before that capability is released. The individual
matrix rows remain the authoritative requirement-level record.

## Applicability decisions added 2026-09-28

| Requirements | Excluded capability | Architecture rationale | Reopen when |
| --- | --- | --- | --- |
| 3.5.2 | CORS-preflight-based CSRF protection | Fylkren does not rely on CORS preflight for this boundary; every authenticated browser mutation requires a session-bound antiforgery token in a custom header | CORS preflight replaces the antiforgery-token control |
| 3.5.4 | Multiple separately trusted applications on one hostname | The SPA and API are one application on one origin; no separately trusted application is hosted on the same hostname | Another application or trust boundary is hosted on the Fylkren hostname |
| 3.5.5 | Cross-origin browser messaging | Fylkren does not use `window.postMessage` | Browser messaging is introduced |
| 6.6.1 | PSTN, voice, or SMS authentication | Fylkren supports local passwords, TOTP, WebAuthn and configured enterprise identity providers, but sends no authentication factor through telephone networks | Any authentication or recovery code is delivered by SMS or voice |
| 7.2.3 | Reference session tokens | Browser sessions use dynamically generated, protected, self-contained ASP.NET cookies rather than server-stored reference tokens | Reference tokens or a server-side ticket store are introduced |
| 10.2.2 | OAuth client connected to multiple authorization servers | One installation can enable only one explicitly configured OIDC issuer; there is no per-request issuer selection | Multiple simultaneous OIDC issuers or dynamic issuer selection is introduced |
| 10.3.1–10.3.4 | OAuth resource server | Fylkren does not accept OAuth access tokens. Its machine API uses separate opaque Fylkren credentials stored only as hashes and authorized by explicit scopes | An API begins accepting OAuth access tokens |
| 10.4.1–10.4.11 | OAuth authorization server | Fylkren does not issue OAuth authorization codes, access tokens or refresh tokens and does not register OAuth clients | Fylkren becomes an OAuth authorization server |
| 10.5.5 | OIDC back-channel logout receiver | Fylkren has no back-channel logout endpoint and does not accept logout tokens | OIDC back-channel logout is supported |
| 10.6.1–10.6.2 | OpenID Provider | Fylkren is an OIDC relying party and does not issue ID Tokens or OIDC authorization responses | Fylkren becomes an OpenID Provider |
| 10.7.1–10.7.3 | OAuth consent server | Fylkren does not authorize third-party OAuth clients or retain OAuth consent grants | Third-party OAuth authorization and consent are introduced |
| 12.1.3 | mTLS client identity | Fylkren does not use client certificates as an authentication identity or authorization input | mTLS client identity or certificate-based authorization is introduced |
| 17.1.1, 17.2.1–17.2.4, 17.3.1–17.3.2 | WebRTC media and signaling | Fylkren has no WebRTC, TURN, RTP/SRTP, media server or WebRTC signaling component; application communication uses HTTPS | Audio/video media, TURN or WebRTC signaling is introduced |

The OIDC relying-party requirements 10.1.1–10.1.2, 10.2.1 and 10.5.1–10.5.4
remain applicable. They require implementation review and closed-environment
testing against a controlled OpenID Provider.

## Current totals

After this first cleanup pass, the Level 2 matrix contains 253 requirements:

- 54 not applicable;
- 24 passed or fulfilled;
- 53 in progress;
- 122 not assessed.

This classification reduces the test inventory; it does not increase the
number of verified controls. The remaining `Not assessed` requirements must
still be evaluated individually as applicable, not applicable, or requiring a
finding.
