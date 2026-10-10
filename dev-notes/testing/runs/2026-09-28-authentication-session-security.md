# Authentication and session security - 2026-09-28

Run ID: `authentication-session-security-2026-09-28`. The focused run started at
22:29 CEST and exercised the maintained local release topology from a fresh
database. It follows the authentication, session-management and CSRF portions of
the OWASP ASVS L2 matrix and the Fylkren security test plan.

| Control | Attack or negative case | Result / evidence |
| --- | --- | --- |
| Authentication disclosure | Unknown identity and oversized username | Pass; both return the same generic `401` problem without implementation details |
| Authentication throttling | Repeated synthetic failures from one client | Pass; fixed-window limiter returns `429`, `Cache-Control: no-store` and a numeric `Retry-After` delay |
| Session cookie | Inspect issued local-login cookie | Pass; `HttpOnly` and `SameSite=Strict` are present. `Secure`/`__Host-` remains part of the separate HTTPS deployment test |
| Sign-out CSRF | Omit the token, submit an invalid token, then submit the bound token | Pass; invalid requests return `400`, the valid request returns `204` |
| Terminated-session replay | Preserve the authenticated cookie, sign out, and replay the preserved cookie | Pass after remediation; replay immediately reports `authenticated: false` |
| Session/account revocation | Revalidate identity state and security version on every authenticated request | Pass in the terminated-cookie regression; this also removes the former two-minute local revalidation gap |
| Coordinated backup and restore | Create, checksum, restore and boot with the matched PostgreSQL/Data Protection set | Pass in the same disposable run |
| Full application regression | Editions, roles, site/GUID isolation, workflows, APIs, reports, webhooks, portability and federation candidates | Pass; `pnpm test:e2e:local` exited zero |
| Cleanup | Disposable containers, networks and volumes | Pass; suite cleanup completed |

After commit `1141bc0` was pushed, a third fresh Compose project ran the
standalone anonymous-boundary script: 6/6 checks passed. The public-surface
script passed 26/27 checks. Its sole failure was the HTTPS redirect assertion,
because this deliberately local target used the documented HTTP development
mode on loopback. Header, cache, anonymous-metadata, protected-route,
foreign-Host, safe-error, static-asset and TRACE checks all passed. This result
does not satisfy or weaken the remaining release-deployment HTTPS gate. The
third project's containers, networks and volumes were then removed.

## Finding SV-048

An ASP.NET authentication cookie is protected against modification but is
self-contained. Explicit sign-out previously removed the browser cookie without
changing server-side identity state. A copied pre-sign-out cookie could therefore
be replayed until its normal expiry. In addition, local session validation could
reuse identity state for two minutes before checking deactivation or security
version changes.

The remediation advances the identity security version during sign-out and
checks identity activity, access and security version on every authenticated
request. The regression deliberately preserves and replays the old cookie after
sign-out. This means an explicit sign-out terminates all sessions for that local
identity, which is the deliberately safer behavior until individual server-side
session records are introduced.

## Scope boundary

This run does not replace the production HTTPS test, expiry/time-travel tests,
parallel factor-change tests, external identity-provider laboratory tests or an
independent penetration test. Those remain separate release gates.
