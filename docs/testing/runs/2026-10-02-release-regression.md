# Release regression and security verification — 2026-10-02

This record covers repeatable local verification of `0.70.0-dev.1`, based on `01b5673` plus the changes committed with this record. It is evidence for the exercised controls, not an independent security approval or a completed ASVS assessment. Production at the public installation was neither changed nor scanned.

## Environment and repeatability

The [safe evidence manifest](2026-10-02-release-regression-evidence.json) records source/test SHA-256 values, immutable scanned image IDs, browser outcomes, final workload measurements and residual package findings.

Node 24.21.0, pnpm 11.19.0, .NET 10 container builds, PostgreSQL 18, Docker Compose and Chromium 152 were used on the development server. Each laboratory started from disposable databases and key volumes. Generated credentials, private test keys, raw logs and generated PDFs remain outside the committed evidence. The browser harness supplies PDF inspection tools inside its disposable Chromium container and uses only loopback host ports.

Commands:

```sh
pnpm test
pnpm typecheck
pnpm build
pnpm check:docs
pnpm check:structure
pnpm check:version
pnpm test:e2e:editions
pnpm test:e2e:browser
pnpm test:e2e:identity-directory
pnpm test:e2e:identity-ad
pnpm test:e2e:identity-sso
pnpm test:e2e:license-expiry
pnpm test:e2e:postgres-upgrade
node tools/run-federation-pair.mjs --production-boundary-only
node tools/run-federation-pair.mjs --load-only
node tools/run-federation-pair.mjs --restore-only
node tools/run-federation-pair.mjs --retention-only
bash tools/security/verify-repository-safety.sh --history
```

The federation and SSO laboratories share TLS ports and must run sequentially. `pnpm test:e2e:totp` and `pnpm test:e2e:webauthn` run the corresponding fresh browser-harness phase independently. These commands destroy only their disposable test volumes; they must not be redirected at a live installation.

## Observed evidence

| Scope | Result and limits |
| --- | --- |
| Frontend | 130 tests in 38 files passed; type checks, production build, documentation links, source-size/language and version checks passed. The existing large-bundle advisory remains. |
| Community/Enterprise API | Clean edition-transition suite passed: role isolation, cross-Site and level routing, multilevel reports, authorization/GUID substitution, API scopes, concurrency, comments, dependencies, decisions, risk/mitigation/version history, learning privacy/treatment/pagination and webhook failure isolation. |
| Backup and upgrade | An existing PostgreSQL volume initialized with the previous root entrypoint started under UID 70 with zero effective capabilities and NoNewPrivs=1, preserving its test data. Disposable coordinated database/key-ring backup and destructive restore passed. Legacy defaults migrated while customized Site-owned content remained unchanged. Backup integrity and bounded retention passed. |
| Browser and report | Real task registration, leader assessment, execution, separate report author/approver, archive, desktop/mobile layouts, keyboard/modal focus, inert stored HTML payload, classified multi-page A4 PDF and SMTP delivery/retry passed. Private positive/improvement learning sentinels were present locally but absent from task/report JSON, approved versions and extracted PDF text. |
| License browser | Signed license file upload, Enterprise controls, Community downgrade and retained Site data passed. |
| TOTP | A pre-fix negative test reproduced authentication from a challenge issued before explicit sign-out. The correction binds challenges to identity security version and uses a new protection purpose. The final negative retest passed: setup replay, adjacent time windows, concurrent recovery/TOTP single-use, tampering and stale challenges after sign-out were rejected. Rejection did not consume unused recovery material. |
| WebAuthn | Virtual CTAP2 registration/sign-in passed. Registration and assertion replay, validly signed wrong-origin/wrong-RP assertions, and a regressed authenticator counter were rejected; failed flows left no session. The initially unhandled registration replay 500 is now a bounded 400, with login verification failures returning 401. Real hardware/platform authenticator coverage remains. |
| AD/LDAP | Maintained live Samba AD and OpenLDAP LDAPS laboratories passed against the updated API. Account disable/expiry, stable anchors, synchronization, session revocation, injection/lifecycle fail-safe behavior, secret protection and outage cases remained covered. |
| OIDC/SAML | Maintained Keycloak/negative-provider laboratory passed signed positive flows and forged state, issuer, nonce, audience, unsigned/tampered assertion and replay negatives, including unlink/relink and direct-SSO boundaries. Cookie cleanup now first leaves the application page so in-flight authenticated page requests cannot renew a cookie after test cleanup. |
| Live licensing | Expiry immediately closed entitlements, retained customer state, paused licensed workers and renewal resumed behavior without restarting. Production signing-key custody was not assessed. |
| Federation Production environment | Default-off work routes, Platform Manager activation, signed ordinary delivery, classified final-report return and deactivation passed; synthetic routes remained absent. Receiver learning remained local, the sender had no copied lessons and outbound message payloads contained no private-learning sentinel. The fixture enters the report-review state directly; execution transitions are covered separately by the edition/browser suites. |
| Federation proxy | Four oversized bodies returned `413`; 20 concurrent discovery requests passed, the next returned `429`, a spoofed forwarded IP did not bypass that limit, and genuine distinct clients had independent partitions. Discovery p50/p95/p99: 54/57/57 ms. |
| Federation matched restore | Database-only restore with a missing key ring refused API startup while decrypting protected provider configuration. Restoring the matching database/key ring preserved instance ID, signing public key/fingerprint and peer approval; a post-backup mutation disappeared and bilateral probes/new work delivery passed. |
| Federation retention | 5,000 expired rows were removed from each federation outbound, receipt and audit fixture. 50,002 recent outbound/receipt rows and 50,000 recent audit rows remained, together with active/unresolved messages and unrelated audit. Indexed delivery-count, newest-delivery, receipt and audit queries completed in 4.706/0.077/0.065/22.018 ms. |

## Workload measurements

After the complete functional fixture passed, the harness created 1,000 additional tasks through ordinary authorized API calls, with eight concurrent writers. The searched queue returned exactly 1,000 tasks through bounded pagination. Each read stage mixed task queues, menu counters, internal learning, report archives and workload history; it also required every corresponding administrative-only task read to return `403`.

| Concurrent readers | Authorized reads | Unauthorized reads rejected | p50 | p95 | p99 | Maximum |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 100 | 100 | 10 ms | 86 ms | 92 ms | 96 ms |
| 10 | 100 | 100 | 16 ms | 130 ms | 148 ms | 149 ms |
| 25 | 100 | 100 | 61 ms | 235 ms | 257 ms | 288 ms |

No read/write or authorization assertion failed. These measurements describe this synthetic dataset and server, with other isolated laboratories running. They are not a production sizing commitment or evidence for thousands of simultaneous users. Large learning/report datasets and customer deployment workloads require separate sizing evidence.

## Scans and remediation

Trivy 0.75.0 used the vulnerability database updated 2026-10-02 12:48 UTC. Repository dependency/content and Dockerfile configuration scans and reachable-history secret checks reported no remaining findings. Dockerfile rule DS-0002 initially flagged the inherited root user; PostgreSQL now starts as its dedicated user, with all capabilities dropped and privilege escalation prohibited. Fresh initialization and coordinated backup/restore are covered by runtime UID/capability assertions. The web image reported no vulnerabilities or secrets. The PostgreSQL image initially reported one Medium finding, `CVE-2026-58055` in `nghttp2-libs`; upgrading Alpine packages during the image build changed `1.69.0-r0` to `1.70.0-r0`. The rebuilt database image reported zero vulnerabilities and secrets.

The API image reported zero Critical/High findings and 14 package findings: nine Medium and five Low, with no vendor FixedVersion available in this scan. The Medium CVEs are `CVE-2026-18374`, `CVE-2026-89092`, `CVE-2026-86145`, `CVE-2026-89161`, `CVE-2026-18477`, `CVE-2026-18508` and `CVE-2026-85091`; repeated libc package occurrences account for the difference between CVEs and package findings. Low findings are `CVE-2025-5222`, `CVE-2026-40228` and `CVE-2024-56433`. No API image secrets were found. These residual findings remain open; this run does not accept their risk on behalf of the security owner.

## Remaining scope

The [ASVS matrix](../../security/ASVS_5.0.0_L2_MATRIX.md) holds the remaining security work and partial evidence; this report does not maintain another security checklist. Its deployment-sensitive rows still require production-equivalent restore/key custody, TLS, canonical Host/port, proxy, customer IdPs and real authenticator evidence. Residual findings remain in the finding register. Historical mixed-version interoperability additionally requires an archived release artifact: the current default federation command exercises the Production boundary and does not execute that legacy compatibility function. External review is optional when requested.

Owners: repository maintainer for remediation and repeatable tests; deployment/security authority for production evidence and risk acceptance. The [security verification record](../../security/SECURITY_VERIFICATION.md) remains the release decision authority.

## ASVS reconciliation and WebAuthn lifecycle continuation

The continuation starts from `382b4691c07c6ed5c67daf704c8c74820db15c04` at the same displayed version. Its source hashes and sanitized results are appended under `continuations` in the existing evidence JSON; the original run's hashes and results remain unchanged.

The [ASVS matrix](../../security/ASVS_5.0.0_L2_MATRIX.md) is now the single security-testing work list. Existing executed tests and run records are linked to 107 requirements, including previously separate browser, LDAP/AD/SSO, authorization, API, learning/report privacy, workload, backup/restore, public-surface/TLS and logging checks. Partial suite coverage remains partial. Nineteen former Passed entries lacked sufficient requirement-specific execution evidence and were downgraded. The resulting 253-row matrix has 20 Passed, 120 In progress, 59 Not assessed and 54 Not applicable requirements. These counts are a traceability audit, not evidence that new controls passed.

`pnpm check:security-evidence` checks matrix completeness, unique requirement IDs, allowed statuses and concrete test/execution-record links for every Passed entry. It also runs as part of `pnpm check:docs`. It does not execute or certify the controls. Matrix regeneration preserves the maintained workflow and evidence preamble.

SV-058 was reproduced before remediation: a registration proof issued before explicit sign-out enrolled a new passkey after a new password sign-in (`204` instead of rejection). Completion still required an authenticated session; this is a stale reauthentication-proof boundary, not demonstrated anonymous takeover. Protected registration/login state now binds the identity security version under `Fylkren.WebAuthnFlow.v2`. Completion locks and reloads identity state and rejects mismatched versions before grant consumption. Registration, login and removal share identity serialization.

The fresh virtual CTAP2 retest passed stale registration/login rejection after sign-out, simultaneous registration and login with exactly one success, registration/assertion replay, validly signed wrong-origin/RP rejection, counter regression, wrong-password removal rejection and pending-login rejection after credential deletion. Failed login attempts left no session. The laboratory uses an inert browser document and independent cookie jars for parallel enrollment so an older cookie renewed by a losing request cannot overwrite the successful request's cookie.

The v2 protection purpose invalidates unfinished v1 ceremonies at upgrade; users restart that registration/sign-in. Existing registered credentials remain usable and no database migration is needed. Hardware/platform compatibility, expiry and the remaining factor lifecycle cases stay open on their ASVS rows. The complete edition/API regression is rerun after this change, including disposable coordinated backup/restore. Laboratories run sequentially because both temporarily manage an absent repository `.env`; an initial overlapping backup run rejected a missing laboratory `.env` and is not passing evidence.

External testing is optional when explicitly requested. Work continues in ASVS chapter/requirement order, adding missing positive, negative and boundary cases to the existing suites and recording results on those rows. No new vulnerability scan, production update or residual-risk acceptance is claimed by this continuation.
