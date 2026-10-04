# Security test plan

This plan turns the security release gate in the [roadmap](../project/ROADMAP.md) into traceable work. The baseline is OWASP ASVS 5.0 Level 2, selected Level 3 requirements for security-critical identity, authorization, audit, and integrations, OWASP WSTG 4.2, and OWASP API Security Top 10 2023.

## Execution method

[ASVS_5.0.0_L2_MATRIX.md](ASVS_5.0.0_L2_MATRIX.md) is the only requirement status matrix. Work follows its chapter and requirement order:

1. Read the next requirement and reconcile its existing evidence.
2. Execute its missing positive, negative and boundary cases in the maintained test suites.
3. Record discovered weaknesses in the finding register, correct them and rerun the failing cases.
4. Record the executed result, tested target, test link, run evidence and remaining scope on that same ASVS row.
5. Mark `Passed` only when the requirement is fully supported; retain explicit gaps on incomplete rows. Record deployment or user dependencies on the affected row before continuing with work that can proceed.
6. Continue to the next requirement. At the end, evaluate the release conditions against this matrix and the finding register.

Execution records support the matrix; they are not separate work lists. External review is optional when explicitly requested. The [federation security review brief](FEDERATION_SECURITY_REVIEW_BRIEF.md) is only a handoff template.

## Site reference authorization

Only Platform Manager may update fallback Site codes through `PUT /api/references/sites/{siteId}`. Verify that a Site Manager with an active assignment receives HTTP 403, including for their own Site; Platform Manager must be able to update a valid code with CSRF protection, while duplicate and invalid codes remain rejected. Existing task references must remain unchanged. This boundary requires dynamic authorization evidence; a successful build is not that evidence.

## Evidence rules

The [ASVS matrix](ASVS_5.0.0_L2_MATRIX.md) is the single security-testing work list. Reconcile already executed security assertions into its existing rows before adding new cases, then proceed in chapter/requirement order. Link both the maintained test and its execution record, state the tested scope and record missing cases on the same row. `pnpm check:security-evidence` checks this traceability and also runs within `pnpm check:docs`; it does not execute controls.

- Link every result to a commit, displayed version, date, environment, and stable ASVS/WSTG identifier.
- Use synthetic data. Never store credentials, cookies, API keys, MFA material, or personal data in the repository.
- Code review alone cannot produce `Passed` when a meaningful dynamic test is possible.
- `Not applicable` requires a short, verifiable rationale.
- Give every finding a stable `SV-*` ID, risk statement, remediation, and retest evidence in [finding register](SECURITY_VERIFICATION.md).
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

All browser endpoints that verify a local password, MFA/passkey proof, reset code
or directory credential share a client-address partition with eight requests per
fixed one-minute window. Rejections include a numeric `Retry-After`
value and cannot be cached. This outer limit reduces online guessing before
password hashing. For known local identities, twenty failed password or MFA
attempts additionally lock that identity for 15 minutes. Successful
authentication clears its failure count. The address limit is intentionally
below the account threshold so a single client cannot cheaply lock accounts;
the account threshold still limits distributed attempts. Authentication errors
remain generic so the response does not reveal whether an identity exists.
OIDC and SAML credentials are verified by the configured identity provider;
Fylkren applies transaction binding and generic callback failure handling rather
than receiving those provider credentials.

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
