# Security verification record

This is the maintained status record for Fylkren's security release gate. It does not replace an independent penetration test. The requirement baseline and evidence rules are defined in the [security test plan](SECURITY_TEST_PLAN.md), while individual ASVS requirements are tracked in the [ASVS matrix](ASVS_5.0.0_L2_MATRIX.md).

Requirements excluded by architecture are justified separately in the [ASVS applicability record](ASVS_APPLICABILITY.md), including the condition that would make each group applicable again.

## Status meaning

| Status | Meaning |
| --- | --- |
| Implemented | A control exists and has passed code/build checks, but all required dynamic evidence is not yet complete |
| Verified | The required repeatable dynamic and negative tests passed against the recorded release candidate |
| Finding | A weakness remains or a required test failed |
| Not assessed | The area has not received sufficient review |
| Not applicable | The requirement is outside the supported architecture with a recorded rationale |

No control is promoted from **Implemented** to **Verified** solely because code was reviewed.

## Current release-gate summary

| Area | Current status | Required completion evidence |
| --- | --- | --- |
| Public surface, proxy, TLS, and headers | Implemented | The 2026-09-28 production run passed TLS 6/6 and public surface 28/28, including wrong Host; retain this evidence per release and complete the explicit wrong-port deployment check |
| Sessions, cookies, and CSRF | Implemented | Lifecycle and parallel-session invalidation passed; complete absolute/sliding expiry, mutation-matrix and external-IdP revocation evidence |
| Local passwords and recovery | Implemented | Concurrent reset and session revocation passed; complete blocklist, reset-expiry and remaining boundary evidence |
| TOTP and recovery codes | Implemented | Setup-token replay, time-window boundary, parallel code consumption, and clock-skew tests |
| WebAuthn and passkeys | Implemented | Registration/sign-in challenge replay, origin/RP validation, counter behavior, and authenticator coverage |
| OIDC, SAML, AD, and LDAP | Implemented | Live closed-laboratory AD/LDAP authentication, lifecycle and outage tests plus OIDC/SAML browser sign-in passed on 2026-09-29; complete replay/forgery, malformed-directory, unlink and exact release-candidate cases |
| Enterprise license lifecycle | Implemented | Real-time expiry, immediate entitlement closure, retained state and renewal without restart passed on 2026-09-29; repeat against the exact release candidate and verify production issuer/key custody |
| Platform/site/level authorization | Implemented | Full role/object matrix through UI and direct HTTP calls, including cross-site and sibling isolation |
| Cross-site assignments and requests | Implemented | Clean E2E rerun proving snapshots, filtered response, return route, workload, and report receipts |
| Independent-instance federation | Implemented in isolated test environment; reviewer handoff defined | Execute the [independent federation review brief](FEDERATION_SECURITY_REVIEW_BRIEF.md), close or accept findings, and complete the remaining threat-model production gates before enabling ordinary routing |
| Rich text, URLs, input, and output | Implemented | Injection payloads, protocol allowlist, field/body bounds, mail headers, print, and PDF |
| Administration and report APIs | Implemented | Complete scope/grant/BOLA, ETag, idempotency, pagination, rate, and concurrency suite |
| Audit, technical logs, and notifications | Implemented | Leakage, isolation, delivery failure, retry, retention, and tamper-boundary evidence |
| Database, concurrency, and performance | Implemented | Transaction-race suite, query measurements, representative load, and recovery behavior |
| Backups and cryptographic keys | Implemented | Matched database/key backup and destructive restore passed in a disposable topology; verify protected production data in the formal restore rehearsal |
| Dependencies, images, and repository | Implemented | Repeat locked dependency, image, secret, history, and configuration scans for release artifacts |
| Retention and sanitization | Implemented | Bounded local backup retention and restore passed; authorized application-data sanitization and immutable-audit coverage remain |

## Implemented control inventory

The following controls were introduced during hardening and must remain covered by regression tests:

### Authentication and sessions

- periodic revalidation of active identity, person, memberships, and platform authority;
- antiforgery enforcement for browser mutations, including sign-out;
- secure cookie attributes, absolute and sliding lifetimes, and persistent Data Protection keys;
- local compromised-password screening without internet lookup;
- account-based failed-attempt lockout in addition to client-address limiting;
- random single-use activation, reset, and recovery material stored only as digests where applicable;
- atomic password-reset consumption and invalidation of superseded sessions;
- TOTP setup binding, current-window verification, replay state, and serialized code consumption;
- single-use WebAuthn challenge storage and identity-level serialization;
- reauthentication before email or authenticator changes;
- strict OIDC callback, SAML module path, WebAuthn RP ID, and origin validation.

### Authorization and isolation

- default authorization for API routes, with a deliberately small anonymous surface;
- separate Platform Manager, Site Manager, and operational capabilities;
- centralized site, work-level, role, and object checks;
- active-site and active-membership validation across sign-in methods;
- exact machine scopes and exact report site/work-level grants;
- concealed report details when existence must not be disclosed;
- immutable cross-site sender snapshots and filtered official responses;
- historical task/report attribution retained after user or site lifecycle changes.

### Input, output, and integrations

- centralized request-body and query bounds;
- server-side pagination and bounded searches;
- constrained rich-text rendering without raw HTML execution;
- URL protocol and credential validation;
- image content verification rather than trust in client MIME type;
- normalized and bounded mail fields resistant to header injection;
- encrypted SMTP credentials and safe UI errors;
- LDAPS or StartTLS for directory adapters and escaped LDAP filters.

### API and resource protection

- one-time, hashed machine secrets with mandatory expiry;
- pre-hash authentication rate limiting and per-process concurrency bounds;
- endpoint rate limits with `429` and backoff semantics;
- ETags for concurrent site mutations;
- retained idempotency records with bounded cleanup;
- audit attribution to machine client and correlation ID without request bodies or secrets.

### Platform and operations

- central no-store policy for API responses;
- CSP, frame, content-type, referrer, permissions, HSTS, and host controls;
- trusted forwarded-header chain and canonical host/port validation;
- non-root web runtime and separated frontend/backend container networks;
- secret sanitization before bounded technical-log storage;
- repository safety and secret scans, dependency checks, and container-image scanning;
- persistent database and Data Protection volumes with documented coordinated backup requirement.

## Open verification work

The current blocking work is verification, not an assumption that the inventory above is production-certified:

1. Complete every `Not assessed` and `In progress` item in the ASVS matrix.
2. Execute the maintained [E2E acceptance matrix](../testing/END_TO_END_TEST_MATRIX.md) from reset synthetic fixtures.
3. Run all automated security scripts against the same release candidate and retain safe evidence.
4. Exercise the remaining TOTP, WebAuthn, API authentication, ETag, and idempotency races.
5. Complete the still-open identity negatives (OIDC replay/forgery, SAML tampering, malformed/ambiguous directories and unlinking), then test WebAuthn in the closed integration environment. Live AD, LDAP, OIDC, SAML and SMTP positive/lifecycle subsets now have dated records.
6. Repeat the passed coordinated database/key-ring restore against the formal release environment and retain protected evidence.
7. Measure authorization-sensitive queries and representative workload at supported deployment sizes.
8. Perform an independent penetration test using the [federation review brief](FEDERATION_SECURITY_REVIEW_BRIEF.md) where applicable, then remediate or formally accept every finding.

## Finding register

New findings use unique, monotonic IDs beginning after the former development series: `SV-047`, `SV-048`, and so on. Never reuse an ID. Each record must include:

- affected requirement and threat-model reference;
- risk and realistic impact;
- affected versions and environments;
- remediation or accepted-risk decision;
- commit and release containing the change;
- negative regression test and retest result;
- owner and closure date.

Historical hardening changes before this maintained register remain traceable in Git history and `CHANGELOG.md`. They are not copied here because a chronological implementation diary obscured current release status and contained duplicate finding IDs.

### Closed findings

| ID | Requirement and severity | Finding and impact | Remediation and retest | Status |
| --- | --- | --- | --- | --- |
| SV-047 | ASVS 8.2.1/8.3.1; Low | A Site Manager with no operational placement or role received `200` and an empty task queue instead of `403`. No task rows or operational content were disclosed, but function-level access did not match the documented separation of administration and operations. | Task overview/list and execution queue entry now require active organizational placement or operational role. The clean disposable 2026-09-27 direct-HTTP rerun passed Site Manager, Platform Manager, sibling, unrelated-site and GUID-substitution negatives while all positive flows passed. See the [run record](../testing/runs/2026-09-27-authorization-guid-substitution.md). | Closed in the next commit after `b3e7c2d`; retested 2026-09-27 |
| SV-048 | ASVS 7.4.1/7.4.2; High | Explicit sign-out removed the browser cookie but did not revoke a copied self-contained authentication cookie. Local identity/security-version changes could also take up to two minutes to be observed. | Sign-out now advances the identity security version and every authenticated request revalidates identity activity, access and version. A negative regression preserves and replays the old cookie and receives an unauthenticated session. See the [run record](../testing/runs/2026-09-28-authentication-session-security.md). | Closed and retested 2026-09-28 |
| SV-049 | ASVS 7.4.2; High | Administrative deactivation made a copied cookie unusable while the identity was inactive, but did not advance its security version. If an administrator later reactivated the same identity, the pre-deactivation cookie could become valid again before normal expiry. | Username or active-state changes now advance the identity security version. The regression preserves a cookie, deactivates the final site membership, verifies rejection, reactivates the identity and verifies that the old cookie remains rejected. See the [run record](../testing/runs/2026-09-28-identity-session-lifecycle.md). | Closed and retested 2026-09-28 |

## Release decision

Security approval requires:

- a justified status for every in-scope ASVS requirement;
- no open Critical or High findings;
- explicit acceptance of residual Medium risks;
- passing automated and manual evidence tied to one release candidate;
- documented deployment assumptions and unsupported boundaries;
- a final report signed by the responsible security authority.

Until those conditions are met, the security posture is **implemented and under verification**, not fully verified for production.
