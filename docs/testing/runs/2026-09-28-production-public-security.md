# Production public security verification - 2026-09-28

Run ID: `production-public-security-2026-09-28`. The maintained security
scripts were executed after deployment against the public origin
`https://fylkren.hostima.no`. Requests were anonymous and did not modify
customer or application data. The authentication-boundary test intentionally
generated synthetic failed sign-ins and left the test source address limited
for at most one fixed one-minute window.

| Control | Observed result | Result / evidence |
| --- | --- | --- |
| TLS versions | TLS 1.2 and 1.3 accepted; TLS 1.0 and 1.1 rejected; default negotiation selected TLS 1.3 | Pass; 6/6 TLS checks |
| Certificate | Valid chain and hostname for `fylkren.hostima.no`; Let's Encrypt certificate valid from 2026-09-10 through 2026-12-09 | Pass; more than 14 days remained |
| HTTPS enforcement | Plain HTTP health request redirected to HTTPS with `301` | Pass |
| Public API headers | `no-store`, `nosniff`, frame denial, no-referrer, CSP and HSTS present | Pass |
| Anonymous disclosure | Public configuration omitted version, edition, entitlements and classification metadata; anonymous session disclosed no identity | Pass |
| Protected routes | Detailed configuration, site list, platform audit and machine administration rejected anonymous requests with `401` | Pass |
| Host and method boundary | Foreign `Host` rejected; TRACE returned `405` | Pass |
| Safe errors | Unknown API route disclosed no implementation details | Pass |
| Static frontend | Home and versioned JavaScript asset served with the expected CSP and immutable asset caching | Pass |
| Authentication disclosure | Unknown identity and oversized username returned generic `401` responses | Pass |
| Authentication throttling | Repeated synthetic failures returned `429`, `Cache-Control: no-store` and numeric `Retry-After` | Pass; 6/6 authentication-boundary checks |

The public-surface script passed 28/28 checks and the TLS and authentication
scripts each passed 6/6. Raw response bodies, cookies and request identifiers
were not retained. This run does not test authenticated session-cookie
attributes, CSRF with a production account, role/site isolation, external
identity providers or independent penetration testing; those remain covered by
their separate release gates and synthetic evidence.
