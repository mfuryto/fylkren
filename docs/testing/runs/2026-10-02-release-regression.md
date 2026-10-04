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

Owners: repository maintainer for remediation and repeatable tests; deployment/security authority for production evidence and risk acceptance. The [finding register](../../security/SECURITY_VERIFICATION.md) records weaknesses and their disposition; the ASVS matrix records test status. Release decisions remain with the authorized owner.

## ASVS reconciliation and WebAuthn lifecycle continuation

The continuation starts from `382b4691c07c6ed5c67daf704c8c74820db15c04` at the same displayed version. Its source hashes and sanitized results are appended under `continuations` in the existing evidence JSON; the original run's hashes and results remain unchanged.

The [ASVS matrix](../../security/ASVS_5.0.0_L2_MATRIX.md) is now the single security-testing work list. Existing executed tests and run records are linked to 107 requirements, including previously separate browser, LDAP/AD/SSO, authorization, API, learning/report privacy, workload, backup/restore, public-surface/TLS and logging checks. Partial suite coverage remains partial. Nineteen former Passed entries lacked sufficient requirement-specific execution evidence and were downgraded. The resulting 253-row matrix has 20 Passed, 120 In progress, 59 Not assessed and 54 Not applicable requirements. These counts are a traceability audit, not evidence that new controls passed.

`pnpm check:security-evidence` checks matrix completeness, unique requirement IDs, allowed statuses and concrete test/execution-record links for every Passed entry. It also runs as part of `pnpm check:docs`. It does not execute or certify the controls. Matrix regeneration preserves the maintained workflow and evidence preamble.

SV-058 was reproduced before remediation: a registration proof issued before explicit sign-out enrolled a new passkey after a new password sign-in (`204` instead of rejection). Completion still required an authenticated session; this is a stale reauthentication-proof boundary, not demonstrated anonymous takeover. Protected registration/login state now binds the identity security version under `Fylkren.WebAuthnFlow.v2`. Completion locks and reloads identity state and rejects mismatched versions before grant consumption. Registration, login and removal share identity serialization.

The fresh virtual CTAP2 retest passed stale registration/login rejection after sign-out, simultaneous registration and login with exactly one success, registration/assertion replay, validly signed wrong-origin/RP rejection, counter regression, wrong-password removal rejection and pending-login rejection after credential deletion. Failed login attempts left no session. The laboratory uses an inert browser document and independent cookie jars for parallel enrollment so an older cookie renewed by a losing request cannot overwrite the successful request's cookie.

The v2 protection purpose invalidates unfinished v1 ceremonies at upgrade; users restart that registration/sign-in. Existing registered credentials remain usable and no database migration is needed. Hardware/platform compatibility, expiry and the remaining factor lifecycle cases stay open on their ASVS rows. The complete edition/API regression is rerun after this change, including disposable coordinated backup/restore. Laboratories run sequentially because both temporarily manage an absent repository `.env`; an initial overlapping backup run rejected a missing laboratory `.env` and is not passing evidence.

External testing is optional when explicitly requested. Work continues in ASVS chapter/requirement order, adding missing positive, negative and boundary cases to the existing suites and recording results on those rows. No new vulnerability scan, production update or residual-risk acceptance is claimed by this continuation.

## ASVS chapter 1 execution

This phase starts from `ab7d12a04648c9fd281815311ad68a0883e7c40e`, version `0.70.0-dev.1`, and follows the maintained ASVS rows. Source and raw-log hashes are recorded in the existing evidence JSON continuation. All runtime work uses disposable synthetic laboratories; production was not tested or changed.

Completed execution:

- `pnpm --filter @fylkren/web test`: 137 frontend tests in 38 files passed, including seven literal/entity/percent/double-percent/script/Markdown/expression renderer and editor-conversion cases. Frontend type checks passed.
- `node tools/run-e2e-editions.mjs --asvs-input-only`: passed seven literal persistence/search payloads (including SQL quote/OR and pg_sleep text), nine unsafe-link rejections and four allowed explicit schemes; nine unsafe-CSS rejections, unchanged-state assertions, safe CSS/comment/media positives, the 20,001-character rejection and legacy unsafe-CSS suppression passed. Multipart script/foreignObject SVG was rejected with SVG and all three allowed raster declarations.
- `node tools/run-release-browser.mjs --community-only`: passed the real Chromium task/report/PDF/SMTP lifecycle. Stored HTML/script/event-handler, entity/percent/double-percent and expression text remained inert. The shared editor inserted plain text from paste/drop while discarding malicious HTML. A detached CSS stylesheet proved escaped `url()` is a real browser resource function without making an external request. The literal `{{7*7}}` task title survived SMTP delivery. Browser errors: zero.

SV-059 was reproduced before correction: escaped CSS resource syntax returned 204 where 400 was required. The final policy rejects escapes/resource/expression functions, handles comments without masking quoted content, and suppresses unsafe legacy CSS on reads. SV-060 was separately reproduced: a protocol-relative document reference returned 201 where 400 was required. The shared link policy now requires an explicit allowed scheme. Both final focused HTTP retests and the browser run passed. Existing safe CSS and explicit http/https/file/smb links remain accepted; legacy CSS using newly prohibited syntax is withheld from rendering until edited.

The criterion-specific SQL review covers all 14 non-migration raw EF call sites: four constant-only calls and ten interpolated parameterized calls. Reviewed files are `FylkrenDbContext`, `IdentityBootstrapEndpoints`, `ApiMaintenanceWorker`, `WebAuthnEndpoints`, `IdentityTotpEndpoints`, `SiteCapacityPolicy` and `IdentitySessionEndpoints`; ordinary queries use EF expressions. No untrusted SQL concatenation was found. Executed SQL-shaped strings persisted and searched as literal data. Inventory and reviewed-file hashes are retained in the sanitized evidence JSON.

An initial HTTP fixture read the task-detail result at the wrong nesting level; it was corrected to the actual `task` field. That failed fixture run is not passing evidence. Neither a passing suite nor these results imply that chapter 1 or all ASVS requirements are complete. The matrix records remaining interpreter/integration boundaries, SSRF destination/DNS/redirect cases and other incomplete requirements. The complete Community/Enterprise edition regression also passed after both corrections, including authorization, lifecycle/workflow/learning cases, 1,000-task load assertions and disposable matched backup/restore. Its sanitized result and raw-log hash are appended to this continuation. `node tools/run-identity-sso-lab.mjs` then passed valid HTTPS XML metadata, external/internal DTD rejection, a 2,000,001-byte body rejection and zero external-entity canary fetches. Negative responses returned bounded 502 problems without XML/stack/canary details. The full signed OIDC/SAML positive, forged-state, issuer/nonce/audience, tampered/unsigned assertion and replay tests also passed. XML assertion-specific DTD/XXE cases remain on row 1.5.1.

## ASVS chapter 1 continuation: data and protocol boundaries

This continuation starts from `edf5ceb`, at `0.70.0-dev.1`, and fills the previously stated requirement gaps. Completed execution is recorded below and under the existing evidence JSON continuation; requirement status remains only in the ASVS matrix.

The focused import retest passed literal entity/percent/backslash metadata, ignored client `$type` markers and 13 malformed/null/numeric manifest cases after SV-061 remediation. The final complete Community/Enterprise API regression passed all 18 manifest cases, valid export validation, two single-JSON-decoding cases and 57 negative numeric cases across ten paged endpoints, SMTP page size and the reference counter. It also passed workflow, authorization, learning privacy, 1,000-task load and matched backup/restore assertions. Restored API/web image identities are recorded in the evidence JSON.

The complete trusted-TLS OIDC/SAML laboratory passed after SV-063 correction. XML connection testing, library runtime metadata ingestion and assertion ingestion all rejected external/internal DTDs, and the controlled external-entity endpoint recorded zero fetches. Metadata was changed only after a successful connection test and activation, before the library loaded it. A rejected SAML challenge now returns bounded generic 502; ordinary anonymous session reads and authenticated local administration remain usable while metadata is invalid. Signed positive SSO, state/issuer/nonce/audience checks, unsigned/tampered/replayed assertions and double-base64 rejection all passed. Double-encoded responses left no session.

SV-061 reproduced a 500 from a manifest with `site: null`; shape validation now rejects null collections/descriptors, unsafe numeric values and malformed fields before inspecting datasets. Invalid ZIP structure/size is rejected before decompression work. SV-062 reproduced a 200 for webhook page `2147483647`; it now uses the shared server pagination bounds. No privilege bypass was demonstrated by either finding. SV-063 reproduced an XML metadata failure during global authentication-handler initialization, affecting unrelated session and administrative requests. The request-scheme provider now initializes SAML only for its own callback routes or explicit challenges; local and OIDC authentication keep their normal handlers. XML/network SAML failures return bounded 400 for callbacks or 502 for challenges without exposing metadata or stack details.

SV-064 source-level reproduction used the unchanged pre-fix permalink parser and browser-standard URL resolution: an item identifier containing traversal/query syntax changed a computed task-detail path to `/api/platform/branding`. No network request or authorization bypass was made or claimed. Permalink identifiers now reject URL syntax before client API path construction; normal identifiers and encoded query text remain supported.

The criterion-specific encoding review inventories the application decoders and interpreter boundaries: structured JSON, URLSearchParams/URI escaping, expected base64/base32 and protected-factor data; React text/attribute rendering, escaped rich-text editor HTML, serialized JSON, escaped print-frame/CSS strings and typed/plain-text mail. There is no application eval/Function/script-compilation engine or client-selected CLR object type. The resource-ownership inventory records 57 stream, request, transaction, cryptographic and DI-scope construction sites, including the explicit disposal of transactions returned by SiteCapacityPolicy. Application C# uses managed strings/arrays and one fixed eight-byte stackalloc Span; no custom unsafe pointer/native-allocation paths or unsafe compiler option were found. Inventories and hashes are stored in the same evidence JSON.

Microsoft's SDK registry returned a missing manifest during final rebuild attempts. Remaining tests reuse the exact API image already built and tested by the SSO lab, with an explicitly selected web image built from the final frontend source. `--no-build` requires explicit candidate images; the edition harness binds the restore script's default tags to those images and verifies restored image layers before testing. An initial reuse attempt let the base restore select an older image and a fixture used the wrong identity-list URL; those failed executions are excluded from passing evidence. The final API, Chromium/SMTP and signed federation tests all completed with exit 0; results and image IDs are recorded in the existing evidence JSON. No production update or residual-risk acceptance is claimed.


The final frontend run passed 148 tests in 38 files, including six permalink identifier attacks and five encoded query round-trips. Type checking, web image build, documentation/253-row traceability, source structure/language, version consistency and whitespace checks passed. Repository safety including Trivy secret scanning of the working tree and reachable history passed with zero failures; this is not an image vulnerability scan.

The final Chromium Community task flow passed stored active-content, plaintext paste/drop, report/PDF, keyboard, desktop/mobile and actual SMTP checks. Five invalid custom-template updates left saved values unchanged; expression strings and placeholder-like task data reached the mailbox literally, without recursive expansion. Messages retained one Subject and no injected Bcc, and data after a standalone dot survived delivery/retry. The first SMTP retest exposed a fixture MIME-decoding defect after the longer title caused quoted-printable wrapping; the sink now decodes quoted-printable, unfolds only headers and reverses SMTP dot stuffing. That failed fixture execution is excluded; the corrected final run passed with zero browser errors.

The trusted-TLS federation pair ran with the application environment set to Production inside the disposable lab. Ordinary signed operational delivery preserved percent/entity/backslash/expression strings exactly in the outgoing payload and recipient database; the ordinary report returned while private learning stayed outside federation. Disabled-route, activation and deactivation boundaries passed. This targeted phase does not rerun all historical federation concurrency cases.

Twelve chapter-1 rows now have criterion-specific completed evidence rather than partial status. The only incomplete chapter-1 rows are 1.3.3 (dangerous-context integration limits), 1.3.6 (outbound destination/DNS/redirect/size boundaries, including the SAML library loader) and 1.4.2 (derived/aggregate arithmetic). Overall matrix: 35 Passed, 112 In progress, 53 Not assessed and 53 Not applicable. These counts do not certify completion of ASVS.

Next session: implement the user's forthcoming architecture changes first, assess which recorded controls they affect, and reopen/retest those rows as needed. Then resume the three incomplete chapter-1 requirements in the same matrix and requirement-order workflow. No additional checklist or approval prerequisite is introduced.

## Activity and lifecycle delivery — 2026-10-03

The architecture continuation uses the [single foundation requirements/implementation/test reference](../../architecture/EVENT_ACTIVITY_AND_INFORMATION_LIFECYCLE.md). The additive stage was verified and committed as `59d8130` before the WorkItem slice began. This continuation does not replace the ASVS matrix or infer completion of all architecture acceptance cases from a passing suite.

The WorkItem slice extends the existing event store and existing delivery queues, preserves independent audit and versioned external/federation representations, and introduces only reversible closure/archive/restoration. No event sourcing, broker, second activity store, arbitrary retention duration, purge or anonymisation was enabled. Whole-Site/user custodianship, comprehensive lifecycle export and other domain activity coverage remain the next delivery.

Reproduction uses the existing edition/browser/federation laboratories and the new package-free foundation database runner:

```sh
node tools/run-foundation-tests.mjs
pnpm test
pnpm typecheck
node tools/run-e2e-editions.mjs --no-build
node tools/run-release-browser.mjs --no-build
node tools/run-federation-pair.mjs --operational-only --no-build
node tools/run-federation-pair.mjs --production-boundary-only --no-build
node tools/run-federation-pair.mjs --retention-only --no-build
pnpm check:docs
pnpm check:structure
pnpm check:version
```

For `--no-build`, set `FYLKREN_E2E_API_IMAGE` and `FYLKREN_E2E_WEB_IMAGE` to the candidate images recorded in the manifest. Edition/browser laboratories share the repository environment fixture and run sequentially. Federation modes share TLS ports and run sequentially. All use disposable synthetic databases; production was neither changed nor scanned.

Final candidate execution results are recorded below. Earlier failed browser attempts revealed a test helper that ignored accessible icon names, a missing wait for dialog keyboard focus, and an SMTP projection backlog metric that still counted migrated audits. These were corrected, without relaxing the assertions. Additional database ownership assertions found and corrected archive propagation through a foreign-owned WorkItem parent; the final guards protect same-owner descendants while preserving foreign ownership/reference. Forced signed receipt replay is explicitly checked to produce one sent/received activity fact.

| Delivered scope | Executed result |
| --- | --- |
| PostgreSQL foundation and WorkItem slice | Passed actual upgrade/downgrade boundaries, immutable facts, actor/metadata validation, state/audit/event/outbox/projection rollback, old-writer rejection across owned content, archive/restore and independent foreign ownership, competing SMTP/webhook claims and recovery. |
| API and compatibility | Full Community/Enterprise regression passed activity/lifecycle authorization, CSRF, pagination, closure/archive/restore plus existing routing, planning, execution, reports, comments, learning, risks/measures/decisions, webhooks, portability and matched backup restore. |
| Frontend | 151 tests in 39 files, type checks and production image build passed. |
| Final core Chromium flow | Object/Site activity, approved report event, root reference, incomplete-history notice, keyboard close, desktop/mobile overflow, PDF/private-learning exclusion and actual SMTP handoff/retry passed. |
| Supplementary browser | Enterprise transitions, TOTP and WebAuthn passed before the later ownership/writer SQL guards and activity label correction. Identity/licensing code was unchanged; exact images are recorded in the manifest. |
| Signed federation | Ordinary send/receive, forced replay with one activity fact, progress/report return, private learning isolation, side/planned requests, cancellation and Production default-off/activation/deactivation/hidden test routes passed. |
| Transport housekeeping | Existing protocol duration removed 5,000 expired outbound and receipt rows each; all 5,000 old independent audit rows were retained. Recent, active and unresolved records remained. No new retention duration or purge policy was introduced. |
| Repository gates | EF pending-model check, documentation/ASVS traceability, structure/language/version and repository/history safety checks passed. ASVS status counts remain 35 Passed, 112 In progress, 53 Not assessed, 53 Not applicable. |

Candidate API and web IDs, 86 source/test hashes and safe outcome data are in the existing [manifest](2026-10-02-release-regression-evidence.json). The API regression used the unchanged gateway configuration before the final activity-label-only web change; the final core browser tested the final API/web pair.

The full fixture plus 1,000 tasks returned every authorized read successfully and rejected all 300 administrative-only workload reads. Its navigation-count p95 at concurrency 1/10/25 was 4,135/7,437/11,522 ms; other endpoint p95 values were at most 239 ms. A reset initial-role fixture against the additive checkpoint also reproduced navigation-count p95 of 105/5,555/9,606 ms. The fixtures have different hierarchy complexity, so these are diagnostic observations, not a controlled performance-equivalence claim. Navigation implementation is unchanged and this sizing issue is explicitly retained in the roadmap. The existing workload harness now records endpoint-level measurements; `--workload-only` repeats its reset initial-role fixture without introducing another test list.

Next architecture delivery is broader risk/measure/decision and other command activity, Site/user custodianship, consistent exit export and policy/hold adapters. Irreversible disposition remains disabled. Navigation-count query sizing is a separate outstanding release concern; security continuation still follows the one ASVS matrix.

## Work-owned domain activity coverage — 2026-10-03

This stage-4 continuation completes the Work-owned command coverage listed in the [same architecture requirements/implementation/test reference](../../architecture/EVENT_ACTIVITY_AND_INFORMATION_LIFECYCLE.md#work-owned-domain-activity-coverage--2026-10-03). Decisions, risks/measures, comments, private learning, planning drafts/RFI and execution follow-up use the existing recorder, projections and independent audit. Decision creation retains the existing v1 fact identity/payload/actor; learning companion facts cannot consume report events. New internal facts do not activate additional notifications, webhook deliveries or federation messages. No schema migration, new store, backfill or retention duration is introduced.

The Lock/Archive action now shows Active/Locked/Archived before opening. The dialog separates state, action and reason, uses short English/Norwegian explanations and accepts multiline reasons by normalizing line breaks before the existing API validation. Closed/archive violations have a distinct `information_locked` problem code with localized guidance, including decision revisions that formerly masked database guards as concurrency conflicts. Other conflicts retain their existing behavior; unfinished relationships, stale versions and unavailable transitions have localized explanations.

The first browser execution found that an authorized owning-level manager who was not the root task author could perform lifecycle transitions but could not read their state. The read gate now uses the same current management authority, retaining membership and negative administrative-only, sibling and foreign boundaries. Failed test-fixture expectations also assumed that learning access granted full root history and that a completion event would always remain in the first 25 rows after adding more activity. Corrected assertions preserve the denied root access and query completion by event type. The added archive browser fixture also initially assumed version zero for newly created lifecycle records; it now reads and submits the actual optimistic-concurrency version. These failed attempts are excluded from final successful results.

Reproduction uses the existing commands, with the immutable candidate API/web images from the [same evidence manifest](2026-10-02-release-regression-evidence.json):

```sh
node tools/run-foundation-tests.mjs
pnpm --filter @fylkren/web test
pnpm typecheck
node tools/run-e2e-editions.mjs --no-build
node tools/run-release-browser.mjs --community-only --no-build
pnpm check:docs
pnpm check:structure
pnpm check:version
```

Set `FYLKREN_E2E_API_IMAGE` and `FYLKREN_E2E_WEB_IMAGE` to the recorded candidates for the two image-backed runners. Edition/browser laboratories run sequentially and restore the repository environment fixture. All tests use disposable databases and synthetic people/work; production is unchanged.

| Scope | Executed result |
| --- | --- |
| Existing foundation/WorkItem and added domain database assertions | Passed real PostgreSQL transaction rollback, immutable event/audit/projection handling, v1 decision identity/payload/actor preservation, report/learning separation, skipped private delivery and risk revision rollback. |
| Frontend | 153 tests in 40 files passed, including localized locked-content errors and preserved unrelated conflicts; type checks and candidate production image builds passed. |
| Community/Enterprise API | Full edition regression, exact-level learning/activity authorization and hidden pagination, resource/type facts and counts, stale revision negatives, manager lifecycle reads, closed comment/decision/status errors, archive/restore and matched database/key backup restore passed. |
| Chromium Community | Actual label/control bounding rectangles, short dialog, state beside the action, archive/restore/reopen with a multiline reason, rejected locked comment, existing keyboard/desktop/mobile activity, classified PDF/private learning and actual SMTP checks passed. |
| External contracts and audit | Existing v1 decision identity/payload preserved in PostgreSQL and edition/webhook regression; audit remains independent. Signed-federation protocol code is unchanged; this continuation does not claim a new signed federation run. |
| Repository | Documentation, single-ASVS evidence links, source structure/language, version and whitespace gates passed. No pending EF model changes. |

The safe manifest records candidate IDs, source/test hashes, log hashes and measured API workload results. The final full fixture plus 1,000 tasks passed all 300 authorized reads and rejected all 300 administrative-only reads. Navigation-count p95 was 91/136/301 ms at concurrency 1/10/25 in this execution, substantially below earlier executions. Navigation source is unchanged; this variation is not evidence of a bottleneck fix. The previously recorded slow navigation-count query remains a separate roadmap item; successful correctness/authorization tests do not resolve it. ASVS counts stay 35 Passed, 112 In progress, 53 Not assessed and 53 Not applicable; this activity continuation does not complete the security assessment.

Next architecture delivery remains whole-Site/shared-user archive and custodianship, consistent exit export and policy/hold administration, followed by guarded disposition/recovery and compatibility-cursor reconciliation. Irreversible deletion, anonymisation and retention-policy execution stay disabled. Complete each coherent delivery with the same traceability before proceeding.

## Governance lifecycle and archive custody — 2026-10-03

The next stage-4 gate passed: Site/global Person lifecycle roots, explicit full-Site archive custody, independent owner guards and shared activity recording. Current grants permit archive-only authentication and read-only timeline/work browsing; ordinary administrative/membership access remains unchanged. Reopening or revocation invalidates archive eligibility. Global historical profile transitions retain attribution in independent global audit; no tenant origin is invented. No deletion/anonymisation or preservation executor is enabled.

| Scope | Executed result |
| --- | --- |
| PostgreSQL foundations | Existing foundation, WorkItem and domain cases plus Site/person guards, independent owners, explicit grant/session eligibility and revocation, shared recorder, immutable policy metadata/hold model and restoration passed. |
| Community/Enterprise API | Complete regression and matched backup/key recovery passed; new Site and global Person archives, explicit archive export, negative administrative/foreign access, blocked edits/last-custodian removal, disabled deletion and reopen invalidation passed. |
| Frontend and Chromium | 157 tests passed. Type check/model consistency passed. Complete Community keyboard/mobile/task/report/PDF/SMTP flow passed, including actual Site closure/archive, named custodian selection and fresh archive-only browser sign-in/read-only history. Browser errors: zero. |
| Repository | Documentation, structure/language, whitespace and repository/history safety checks passed; Trivy secret scan found no repository secrets. |

Excluded attempts exposed a genuine combined Platform/Site Manager navigation-priority defect, now fixed and regression-tested. Additional login cases originally exceeded the existing authentication partition; test order/window isolation corrected without weakening limits. The SMTP retry assertion now runs before the new authentication waiting window. The earliest downgrade guard also prevents partial removal of governance tables after cutover. These failed attempts are not counted as passing evidence.

The new exact exclusive-`until` assertion was added after the API process loaded the original module; execute it with the next dependent API run before claiming that added assertion. Browser dates and the shared query use the documented inclusive-from/exclusive-until convention.

Immutable candidate IDs, source/test hashes and safe results are in the [same evidence manifest](2026-10-02-release-regression-evidence.json). API and browser labs ran sequentially and restored environment fixtures. Production was unchanged. Navigation-count p95 was 3,200/5,869/9,163 ms at concurrency 1/10/25, reproducing the separately tracked sizing concern; correctness/authorization checks passed and no performance fix is claimed. ASVS status counts remain unchanged.

The next dependent stage adds consistent lifecycle portability, durable preservation administration and export receipts, then reconciles compatibility projection before retiring it. Destructive disposition/recovery remains disabled and deferred.

## Snapshot export and preservation — 2026-10-03

The dependent export/preservation stage passed against the immutable API/web images recorded in the same evidence manifest. PostgreSQL tests verify a concurrent independent writer cannot mix related export snapshots; historical risk owners without membership remain resolvable; foreign private content is excluded; failed byte/file-count limits produce no success audit or receipt. Custody acknowledgement rejects a wrong digest, stale version and repeat. Populated legacy holds retain explicit unknown original actor and migration-time provenance. Manipulated owner/policy datasets are rejected with otherwise correct hashes; 1.0 remains accepted with a warning.

The maintained Community/Enterprise API chain and matched database/key restore passed, including independent hold release, immutable policy versions, unauthorized preservation/export custody, disabled disposition, archive-only export and exact inclusive-from/exclusive-until timeline assertions. Complete Chromium task/report/PDF/SMTP/keyboard/mobile flow passed with actual hold/release and archive-only sign-in; zero browser errors. 157 frontend tests, type/model consistency, documentation, structure/language, version and whitespace checks passed.

The maintained two-instance retention laboratory passed at the unchanged configured 2555-day horizon: 5,000 expired outbound rows and 5,000 receipts removed, zero security audit rows removed; active/unresolved and 50,000 audit rows retained. Separate real PostgreSQL tests verify owner isolation and an in-flight committed hold serializes housekeeping and keeps its evidence.

Excluded attempts: the schema-test helper initially failed a compile-time raw-SQL warning; the browser fixture initially clicked while preservation controls were loading. Both were corrected and their complete relevant chains passed. Additional owner/policy HTTP parser cases were added after the running module loaded; equivalent real-package foundation cases passed and the new HTTP assertions must execute in the final dependent run. No purge-plan, large-package chunking, import apply or destructive recovery proof is claimed. ASVS counts and production remain unchanged.

## Consumer reconciliation and final reversible foundation — 2026-10-03

The final authorized reversible continuation retires runtime audit scanning for notifications, transfers pending legacy webhook obligations to the existing common projection ledger and records machine Site changes and Work-owned access-release effects through the shared recorder. Security audit records remain independent. The upgrade-only legacy drain resumes durable batches, preserves frozen outbox content and completes an idempotent checkpoint; no speculative historical facts or deliveries are created. Closed global Person profiles remain preserved during directory synchronization. Requirements and maintained assertions remain in the [same architecture traceability](../../architecture/EVENT_ACTIVITY_AND_INFORMATION_LIFECYCLE.md#consumer-reconciliation-and-remaining-access-effects--2026-10-03).

The final immutable API is `sha256:08e11410db3ea6d52a2e033aa3dac5f72e45753c3589532d8d9f73caf76631cf`; unchanged web is `sha256:66ef2bb6b600cf9539a8c1067ef24043d6cf1b1b6888ee05e143349fee2689be`. Source/test hashes and safe result summaries are retained in the existing evidence manifest.

| Scope | Executed result |
| --- | --- |
| Real PostgreSQL foundations | All existing chains plus populated legacy upgrade/rollback, interruption after a durable batch, concurrent resumes, existing frozen-delivery deduplication, completed no-op, old-writer rejection, typed machine audit/request correlation, real machine-audit export validation and owned system-release facts passed. |
| Complete Community/Enterprise API | Archive/custody, preservation, immutable policy versions, authorization/privacy, portable export and matched database/key recovery passed. Added HTTP owner/policy parser cases and exact exclusive-until assertions now executed successfully. The 1,000-task fixture passed all authorized reads and rejected all 300 administrative-only workload reads. |
| LDAP / Active Directory / OIDC / SAML | All maintained identity labs passed against the exact final images. LDAP additionally verified a closed global profile remains unchanged during a real TLS directory sync and has no active session. |
| Chromium | Complete Community task/report/PDF/SMTP/keyboard/mobile flow passed with zero browser errors. Actual saved ZIP custody acknowledgement, independent hold/release, named Site custodian and fresh archive-only sign-in/read-only timeline passed. |
| Signed federation | Maintained operational chain and Production TLS/activation/route gates passed against the exact final images; replay/deduplication, progress, official answers, cancellation and private-learning exclusion retained existing contracts. |
| Federation transport retention | Existing 2,555-day configuration removed 5,000 expired outbound rows and 5,000 receipts, zero audit records. Active/unresolved evidence and all 50,000 audit records were retained. Separate real PostgreSQL hold/owner concurrency cases also passed. |
| Frontend/model and repository | 157 tests in 40 files, type check, EF model consistency, documentation/ASVS links, structure/language, version, whitespace and repository/reachable-history safety checks passed. |

API navigation-count p95 was 96/138/253 ms at concurrency 1/10/25. Earlier slow observations remain open in the roadmap; this unchanged-query run does not establish a performance fix.

Excluded attempts exposed a genuine trigger field-access defect and machine-audit opaque request-ID parser mismatch; both were corrected and the full affected foundation/API chains passed against the final image. One initial SSO run failed with Chromium `net::ERR_NETWORK_CHANGED` while other disposable Docker networks changed; the complete SSO lab passed when run alone. Failed attempts are excluded from passing evidence.

All authorized reversible delivery stages passed their relevant checks before completion. No production deployment, irreversible deletion/anonymisation, retention executor, import apply, chunked export or destructive recovery qualification is claimed. ASVS statuses remain unchanged; scoped affected-control retests are linked in the existing matrix.

## Lifecycle icons and governance guidance — 2026-10-04

UI-only continuation against the unchanged final foundation API and the exact web image recorded in the same evidence manifest. The maintained complete Community Chromium task/report/PDF/SMTP/keyboard/mobile chain passed with zero browser errors. Actual WorkItem lock/archive/restore/reopen verified accessible icon states without appended visible status text. Site/person dialogs identify their resource; governance actions/reasons precede archive administration. A real active person remains blocked from locking after entering a reason. Actual **Sites → Edit → Deactivate** shows the preserved Site as **Inactive**, then named custody, Site closure/archive, fresh archive-only sign-in/read-only history and saved ZIP custody acknowledgement passed.

157 frontend tests in 40 files, type checks, structure/language, documentation and version checks passed. Context guidance is present in all 19 supported languages. API/federation/lifecycle authorization and independent audit contracts are unchanged; no new backend or identity/federation qualification is claimed. Production, irreversible disposition and ASVS statuses remain unchanged. Traceability: [existing lifecycle architecture](../../architecture/EVENT_ACTIVITY_AND_INFORMATION_LIFECYCLE.md#lifecycle-presentation-clarification--2026-10-04).

## Automatic WorkItem lifecycle — 2026-10-04

Continuation from `4bcd2bc`; schema `20261004085939_AutomaticWorkLifecycle`. Requirements, implementation and maintained tests are traced in the [same architecture reference](../../architecture/EVENT_ACTIVITY_AND_INFORMATION_LIFECYCLE.md#automatic-workitem-lifecycle--2026-10-04); requirement statuses remain in the single ASVS matrix.

The final candidate locks eligible terminal WorkItems in the operational transaction and archives them after existing follow-up/delivery resolve. Explicit reopening pauses automation, original observations remain protected while authorized learning treatment continues, and Archived/All/search preserve visible history and child context. Site/global-user retirement remains administrative. Chain cancellation preserves terminal branches instead of rewriting locked decisions/reports. No event sourcing, broker, replacement audit, second event store, new retention duration, deletion or anonymisation is introduced.

Final API: `sha256:5dbcddde46baf40ddee0d849858b58bf9a616abf853ef33184b012472817fbcd`; web: `sha256:95c69456ec0870a718f167db181344235d23ccd5744ec99a0879df61d3c9f497`. The full API/recovery and federation runs used web gateway `sha256:d1ce2a9dd7ec9fe8c99d7048ca3c41eb0a0e4df0d1ed336ce19332d853a3d570`; the final web-only change additionally displays prerequisites and disables Finish editing until they resolve. Gateway/nginx code is unchanged; Chromium tests the final UI image. Safe source/image/log hashes and results are appended to the existing evidence manifest. Raw logs and synthetic credentials stay outside tracked repository content; production is untouched.

The PostgreSQL foundation chain passed, including new atomic terminal lock/audit/activity rollback, pending/failed delivery and shared-projection archive gates, competing-worker idempotence, explicit editing pause, own/descendant preservation, concurrent child-hold contention without rejecting the valid operational decision, protected learning treatment and whole-Site negatives, archived-child/all/search selection with stable counters, populated pause-aware upgrade without invented facts/delivery and guarded downgrade. Frontend: 157 tests in 40 files; type checks passed. EF model consistency and existing documentation/language/structure/version gates passed. Repository/reachable-history secret checks passed.

Signed operational federation passed receipt/retry fact deduplication, progress, official report return, private-learning exclusion, side/planned requests and cancellation. The Production-boundary chain passed activation/deactivation, absent synthetic routes, disabled routing gates and ordinary report return. Transport-retention regression passed 5,000 expired outbound and 5,000 receipt removals for unpreserved eligible synthetic records, while retaining active/unresolved/recent evidence and independent audit. This existing transport policy does not introduce customer-content disposition.

The full final-API Community/Enterprise and matched database/Data Protection key restore chain passed, including actual task closure, reasoned editing pause, preserved chain cancellation, learning treatment after task locking, unchanged public/machine contracts, negative authorization and the maintained 1,000-task workload. The full Chromium task/report/PDF/SMTP/keyboard/mobile/governance chain passed on the final UI image with zero browser errors and no desktop/mobile overflow. It exercises automatic lock/archive, Archived lookup, protected writes, direct atomic reopening, an editing pause surviving a worker cycle, Finish editing and subsequent automatic archive. Earlier intermediate-API success is not substituted for the final API image checks. Corrected/excluded attempts include historical-schema fixture incompatibility, cancellation of already terminal branches, and the wrapped PostgreSQL row-lock exception caught by the new contention test. Affected complete chains were repeated after corrections.

Scoped ASVS 8.2.1, 8.2.2, 8.4.1 and 16.5.3 evidence is recorded in the existing matrix; no overall requirement is promoted. Navigation-count production sizing, remaining matrix clauses, unchanged identity-provider qualification, mixed-version federation, irreversible disposition and large-export/import apply remain outside this continuation.
