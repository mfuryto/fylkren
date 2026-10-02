# Security verification record

This is the maintained status record for Fylkren's security release gate. The ASVS matrix is the single requirement-level testing work list; this record holds findings and release status. An external review is optional when explicitly requested. The requirement baseline and evidence rules are defined in the [security test plan](SECURITY_TEST_PLAN.md), while individual ASVS requirements are tracked in the [ASVS matrix](ASVS_5.0.0_L2_MATRIX.md).

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

The [2026-10-02 release regression](../testing/runs/2026-10-02-release-regression.md) records the latest fresh local edition, browser/PDF/learning privacy, identity, license, workload, federation and restore evidence. This adds measured evidence without declaring the remaining ASVS or production gates complete.

| Area | Current status | Required completion evidence |
| --- | --- | --- |
| Public surface, proxy, TLS, and headers | Implemented | The 2026-09-28 production run passed TLS 6/6 and public surface 28/28, including wrong Host; retain this evidence per release and complete the explicit wrong-port deployment check |
| Sessions, cookies, and CSRF | Implemented | Lifecycle and parallel-session invalidation passed; complete absolute/sliding expiry, mutation-matrix and external-IdP revocation evidence |
| Local passwords and recovery | Implemented | Concurrent reset and session revocation passed; complete blocklist, reset-expiry and remaining boundary evidence |
| TOTP and recovery codes | Implemented | The 2026-10-02 lab passed setup replay, adjacent-window rejection, concurrent TOTP/recovery single-use and sign-out challenge invalidation; expiry/clock-skew and remaining lifecycle boundaries still need evidence |
| WebAuthn and passkeys | Implemented | The 2026-10-02 virtual CTAP2 lab passed registration/sign-in, replay, origin/RP, counter regression, concurrent single-use, security-version revocation and removal boundaries; hardware/platform authenticators, expiry and remaining lifecycle evidence still need coverage |
| OIDC, SAML, AD, and LDAP | Implemented | The maintained 2026-09-29 laboratories now pass the complete E2E-14 functional and negative identity scope, including exact issuer/entity binding, nonce/audience, unsigned/tampered/replayed assertions, lifecycle fail-safe cases, unlink/relink and one-time environment import; repeat unchanged against the exact release candidate and representative customer IdPs |
| Enterprise license lifecycle | Implemented | Real-time expiry, immediate entitlement closure, retained state and renewal without restart passed on 2026-09-29; repeat against the exact release candidate and verify production issuer/key custody |
| Platform/site/level authorization | Implemented | Full role/object matrix through UI and direct HTTP calls, including cross-site and sibling isolation |
| Cross-site assignments and requests | Implemented | Clean E2E rerun proving snapshots, filtered response, return route, workload, and report receipts |
| Independent-instance federation | Implemented in isolated test environment; reviewer handoff defined | Complete the applicable ASVS and federation threat-model controls, close or accept findings, and verify the supported deployment before enabling ordinary routing; the external review brief is optional |
| Rich text, URLs, input, and output | Implemented | Injection payloads, protocol allowlist, field/body bounds, mail headers, print, and PDF |
| Administration and report APIs | Implemented | Complete scope/grant/BOLA, ETag, idempotency, pagination, rate, and concurrency suite |
| Audit, technical logs, and notifications | Implemented | Leakage, isolation, delivery failure, retry, retention, and tamper-boundary evidence |
| Database, concurrency, and performance | Implemented | Clean concurrency/restore tests and the 1,000-task/25-reader and 50,000-row federation fixture passed on 2026-10-02; customer sizing and large learning/report datasets remain |
| Backups and cryptographic keys | Implemented | Matched database/key backup and destructive restore passed in a disposable topology; verify protected production data in the formal restore rehearsal |
| Dependencies, images, and repository | Finding | Fresh scans have no Critical/High vulnerabilities; vendor-unfixed API Medium/Low findings remain open as SV-055. Available PostgreSQL patch and non-root configuration are addressed in this change |
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

The [ASVS matrix](ASVS_5.0.0_L2_MATRIX.md) is the sole security-testing work list. Existing test implementations and execution records are linked in its evidence cells, with remaining scope on the same row. Proceed systematically through its chapters; complete positive, negative and boundary tests before marking a requirement Passed. Rerun affected controls after remediation and freeze the tested candidate in the run evidence. The E2E acceptance matrix remains the functional acceptance baseline, not a competing security checklist.

Production-only controls, representative deployment sizing and the formal database/key-ring restore must be verified in their authorized environment. An external tester is not a prerequisite for this work; the existing federation review brief is an optional handoff if an external review is later requested.

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
| SV-050 | ASVS 10.5.3; Medium | The OIDC connection test accepted syntactically valid HTTPS metadata even when its issuer differed from the configured authority. A trusted or compromised endpoint could therefore approve metadata for another issuer. | Connection testing now requires exact canonical issuer binding and HTTPS authorization, token and JWKS endpoints. A dedicated trusted-TLS mismatch fixture returns `502`; valid Keycloak metadata and the complete browser flow still pass. See the [run record](../testing/runs/2026-09-29-live-oidc-saml-identity.md). | Closed and retested 2026-09-29 |
| SV-051 | ASVS 10.1.2/10.2.1; High | A captured OIDC callback replay returned an error but could leave a local application session after the remote handler failed. This violated the rule that a rejected external transaction must never authenticate the browser. | Every OIDC remote failure now explicitly signs out partial local state before returning generic non-cacheable `400`. SAML signature and token-replay failures receive the same bounded handling. Clean-browser forged-state, callback replay, assertion tampering and assertion replay tests all return `400` with no session. See the [run record](../testing/runs/2026-09-29-live-oidc-saml-identity.md). | Closed and retested 2026-09-29 |
| SV-052 | ASVS 7.4.1/10.1.2; High | In a long provider-switch and unlink/relink sequence, a rejected OIDC or SAML callback could return `400` while a partial application cookie from the remote handler survived. A rejection response was therefore not an atomic authentication failure boundary. | A callback-boundary middleware now registers final response handling and deletes the actual configured application cookie, including chunks, whenever an OIDC or SAML callback finishes with an error. The expanded live run repeats forged state, callback replay, wrong nonce/audience, unsigned/tampered SAML and assertion replay after provider switches and proves every rejection leaves an unauthenticated session. | Closed and retested 2026-09-29 |

### Additional closed findings from the 2026-10-02 run

| ID | Requirement and severity | Finding and impact | Remediation and retest | Status |
| --- | --- | --- | --- | --- |
| SV-053 | ASVS 7.4.1; TM-15; High | A pending TOTP challenge carried the identity and expiry but no security version. After explicit sign-out, the pre-sign-out password proof could still be completed with a valid remaining recovery code. | TOTP challenge protection v2 carries security version; completion checks it under the identity lock before consuming factor material. The fresh HTTP regression rejected the stale challenge and accepted the unused recovery code with a new challenge. Password/factor security-version changes use the same invalidation check. | Closed in the commit containing this record; retested 2026-10-02 |
| SV-054 | Dependency maintenance; Medium | PostgreSQL image included nghttp2-libs 1.69.0-r0 with CVE-2026-58055 and an available fix. | Upgrade Alpine packages during image construction; installed 1.70.0-r0. Rebuilt image scan reported zero vulnerabilities. Fresh database/backup/restore regression passed. | Closed in the commit containing this record; retested 2026-10-02 |
| SV-056 | Container least privilege; scanner DS-0002 High | PostgreSQL's Dockerfile inherited the root image user. Its entrypoint normally dropped the server process to postgres, but initialization and default container exec still started with root privileges. | Set USER postgres, drop all capabilities and prohibit privilege escalation. The fresh database/restore fixture asserts non-root UID, zero effective capabilities and NoNewPrivs=1. A separate existing-volume upgrade from the former root entrypoint preserved data under UID 70. The configuration rescan has zero findings. | Closed in the commit containing this record; retested 2026-10-02 |
| SV-057 | TM-15; Low | Invalid/replayed WebAuthn verification responses escaped as unhandled 500 errors. The observed registration replay did not create another credential or bypass authentication, but produced a server failure instead of a controlled rejection. | Handle only Fido2VerificationException on WebAuthn routes; return bounded generic 400 for registration and 401 for login, without logging assertion/attestation material. The fresh virtual CTAP2 run rejected registration/assertion replay, validly signed wrong-origin/wrong-RP responses and counter regression; every failed login left no session. | Closed in the commit containing this record; retested 2026-10-02 |
| SV-058 | ASVS 7.4.1 / 7.5.1; TM-15; Medium | A passkey registration proof issued before sign-out still enrolled a credential after a new password sign-in. An earlier reauthentication proof therefore survived security-version revocation; completion still required an authenticated session. | WebAuthn protected state v2 carries security version. Completion locks and reloads identity state, rejects stale state before grant consumption and serializes registration/login/removal. The fresh CTAP2 lab rejected stale registration and login after sign-out, enforced single-use under concurrent requests and rejected pending login after credential removal. See the release run and ASVS rows for evidence. | Closed in the commit containing this record; retested 2026-10-02; maintainer |

### Open residual findings

| ID | Risk and affected environment | Owner and disposition |
| --- | --- | --- |
| SV-055 | API Ubuntu 24.04 image: nine Medium and five Low package occurrences, no vendor FixedVersion available in the 2026-10-02 Trivy database. Seven distinct Medium and three distinct Low CVEs are listed in the run record. No Critical/High image vulnerabilities or embedded secrets were reported. Runtime exposure and exploitability are not inferred from the scanner alone. | Maintainer monitors upstream fixes; responsible security authority must assess exposure and explicitly accept remaining Medium risk before release approval. Open, not accepted by this run. |

## Release decision

Security approval requires:

- a justified status for every in-scope ASVS requirement;
- no open Critical or High findings;
- explicit acceptance of residual Medium risks;
- passing automated and manual evidence tied to one release candidate;
- documented deployment assumptions and unsupported boundaries;
- a final report signed by the responsible security authority.

Until those conditions are met, the security posture is **implemented and under verification**, not fully verified for production.
