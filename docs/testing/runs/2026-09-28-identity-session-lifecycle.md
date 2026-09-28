# Identity and session lifecycle - 2026-09-28

Run ID: `identity-session-lifecycle-2026-09-28`. The final run used a fresh disposable Compose deployment with the maintained Community/Enterprise transition fixture. It exercised OWASP ASVS session termination and authentication-factor lifecycle controls through direct HTTP requests. No credentials, reset codes or cookies were retained.

| Control | Negative case | Observed result |
| --- | --- | --- |
| Password-change revocation | Preserve a second authenticated cookie, change the password in the first session, then replay the second cookie | Pass; the preserved session immediately reports unauthenticated |
| Reset-code atomicity | Submit the same valid reset code concurrently twice | Pass; exactly one request returns `204`, while the competing request returns generic `400` |
| Password-reset revocation | Preserve the active cookie before completing reset, then replay it | Pass; the preserved session immediately reports unauthenticated |
| Administrative deactivation | Preserve a cookie, remove the person's final active site membership, then replay it | Pass; the identity is disabled and the preserved session reports unauthenticated |
| Reactivation replay | Reactivate and reassign the same person, then replay the pre-deactivation cookie | Pass after remediation; the old cookie remains unauthenticated |
| Existing authentication boundary | Repeat generic-failure and rate-limit assertions after the lifecycle scenarios | Pass; generic `401`, then `429` with `no-store` and `Retry-After` |
| Full regression | Editions, backup/restore, roles, site isolation, workflows, reports, APIs, portability and federation candidates | Pass; `pnpm test:e2e:local` exited zero |
| Cleanup | Disposable containers, networks and volumes | Pass; suite cleanup completed |

## Finding SV-049

The application already revalidated identity state on every authenticated request, so a disabled identity could not use an existing cookie. However, deactivation and later reactivation changed `IsActive` without changing the identity security version. A copied self-contained cookie from before deactivation could therefore become valid again after reactivation.

`LoginIdentity.Update` now advances the security version whenever the normalized username or active state changes. The negative regression deliberately preserves the cookie across both administrative transitions and proves that reactivation cannot revive it.

## Scope boundary

This run verifies local-account password and administrative lifecycle behavior. TOTP recovery-code replay, WebAuthn concurrency, time-travel expiry and live AD/LDAP/OIDC/SAML revocation remain separate verification work. It does not replace an independent penetration test.
