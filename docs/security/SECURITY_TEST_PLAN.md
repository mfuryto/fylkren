# Security test plan

This plan turns the security release gate in the [roadmap](../project/ROADMAP.md) into traceable work. The baseline is OWASP ASVS 5.0 Level 2, selected Level 3 requirements for security-critical identity, authorization, audit, and integrations, OWASP WSTG 4.2, and OWASP API Security Top 10 2023.

## Phases

1. Freeze the requirement baseline and maintain the complete Level 2 traceability matrix.
2. Verify anonymous exposure, reverse proxy, TLS, headers, caching, and safe errors.
3. Verify authentication, sessions, local passwords, recovery, TOTP, and WebAuthn/passkeys with negative and concurrent tests.
4. Verify platform, site, level, role, and object authorization against the access matrix.
5. Verify browser mutations, CSRF, input limits, rich text, URLs, document references, print, and PDF output.
6. Verify administration and report APIs against OWASP API Security Top 10.
7. Verify operational history, audit isolation, notification failures, secret sanitization, backup, and restore.
8. Run dependency, repository, container-image, and configuration scans; remediate and retest every finding; issue the final security report.

The federation portion is handed to the independent reviewer through the [federation security review brief](FEDERATION_SECURITY_REVIEW_BRIEF.md). It freezes the target, enumerates the externally reachable and management surfaces, defines the minimum adversarial coverage and separates maintained regression evidence from reviewer-owned tests.

## Evidence rules

- Link every result to a commit, displayed version, date, environment, and stable ASVS/WSTG identifier.
- Use synthetic data. Never store credentials, cookies, API keys, MFA material, or personal data in the repository.
- Code review alone cannot produce `Passed` when a meaningful dynamic test is possible.
- `Not applicable` requires a short, verifiable rationale.
- Give every finding a stable `SV-*` ID, risk statement, remediation, and retest evidence in [Security verification](SECURITY_VERIFICATION.md).
- Automated tests must fail closed on unexpected responses. Manual tests require explicit steps and expected results.
- Keep raw evidence outside Git when it can contain sensitive deployment information; reference it by controlled identifier.

## Maintained automated checks

Public HTTPS surface:

```bash
bash tools/security/verify-public-surface.sh https://fylkren.example
```

This covers representative WSTG configuration, session, and error-handling checks: headers, HSTS, no-store behavior, anonymous boundaries, unknown API routes, host validation, disabled TRACE, and absence of technical exception details.

Generate the ASVS matrix from the pinned OWASP 5.0.0 source:

```bash
node tools/generate-asvs-matrix.mjs /tmp/asvs-5.0.0.json \
  docs/security/ASVS_5.0.0_L2_MATRIX.md
```

Session cookie, sign-in, sign-out, and antiforgery using ignored local synthetic credentials:

```bash
bash tools/security/verify-session-csrf.sh \
  https://fylkren.example e2e-test-credentials.local ordinary1
```

The script must never print passwords, cookies, or tokens. It verifies cookie attributes, rejection of sign-out without CSRF, successful token use, and invalidation after sign-out.

Site and role isolation with synthetic leaders from different sites:

```bash
bash tools/security/verify-site-isolation.sh \
  https://fylkren.example e2e-test-credentials.local leader1 leader2
```

Verify that each account sees only its work context and that foreign tasks, organization, personnel, planning, execution, and platform operations are rejected.

Anonymous authentication boundary and rate limiting:

```bash
bash tools/security/verify-auth-boundary.sh https://fylkren.example
```

This must produce generic responses for unknown and oversized identities and eventually return `429`. The test client can remain rate-limited for one configured window.

All browser authentication endpoints share a client-address partition with eight
requests per fixed one-minute window. Rejections include a numeric `Retry-After`
value and cannot be cached. This outer limit reduces online guessing before
password hashing. For known local identities, twenty failed password or MFA
attempts additionally lock that identity for 15 minutes. Successful
authentication clears its failure count. The address limit is intentionally
below the account threshold so a single client cannot cheaply lock accounts;
the account threshold still limits distributed attempts. Authentication errors
remain generic so the response does not reveal whether an identity exists.

TLS protocol, certificate chain, host name, and minimum remaining lifetime:

```bash
bash tools/security/verify-tls.sh fylkren.example 443
```

Repository and secret safety:

```bash
bash tools/security/verify-repository-safety.sh
```

Enterprise identity laboratories:

```bash
pnpm test:e2e:identity-directory
pnpm test:e2e:identity-ad
pnpm test:e2e:identity-sso
```

These disposable Compose laboratories build the production application and use
live OpenLDAP over trusted LDAPS, Samba Active Directory over trusted LDAPS,
two Keycloak issuer realms, an isolated negative OIDC provider and headless
Chromium. They cover one-time environment import, protected GUI configuration,
stable and exact provider namespaces, scheduled/manual deprovisioning,
disabled/expired/missing/restored identities, ambiguous and malformed LDAP
data, invalid binds and outages, LDAP filter injection, unlink/relink and
preserved internal identity, Platform Manager lockout guards, direct-SSO
presentation/cancellation, wrong issuer/state/nonce/audience, unsigned or
tampered SAML and OIDC/SAML replay. Every rejected callback must return a
controlled error and leave no authenticated Fylkren session. Dated evidence is
retained under `docs/testing/runs/` without generated credentials or tokens.

Run all applicable unit, integration, frontend, Compose, and image checks documented in the development and operations manuals before recording a release result.

## Required manual and dynamic coverage

- account lifecycle, reauthentication, lockout, reset races, session revocation, MFA replay, and passkey challenge replay;
- BOLA/IDOR and vertical escalation across every site and work-level relationship;
- cross-site task and request information filtering in both directions;
- independent-instance federation signature/address substitution, replay, peer revocation, top-level site lifecycle, payload minimization, concurrent retry, mixed versions and peer outage/recovery;
- CSRF and content-type variations for every browser mutation;
- stored and reflected injection through rich text, labels, names, URLs, mail headers, IdP attributes, reports, print, and PDF;
- body, search, pagination, concurrency, rate-limit, and resource-exhaustion boundaries;
- exact administration/report API scopes, grants, ETags, idempotency, and concealed resources;
- log, audit, email, browser-storage, and URL leakage;
- restore of a matched database and Data Protection key set;
- AD/LDAP authentication and automatic deprovisioning—including disabled, expired, deleted, restored and unavailable-directory states—plus OIDC, SAML, SMTP, TOTP, and WebAuthn in the closed integration environment;
- air-gapped startup and operation without runtime internet dependency.

## Completion criteria

Security verification is complete only when the traceability matrix has a justified status for every in-scope requirement, all High and Critical findings are closed, accepted residual risks are signed off, automated checks are repeatable, dynamic evidence is retained, and the final report states scope, limitations, findings, retests, and deployment assumptions.
