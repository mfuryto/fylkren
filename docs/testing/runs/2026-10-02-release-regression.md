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


## Execution activity clarity — 2026-10-04

Focused continuation from `776b212`: normalized unchanged execution saves no longer write documents/timeline replacements or new activity/audit; actual document/timeline edits and step selection retain the existing common fact and independent audit action. New events snapshot bounded step display number/name. Timeline and Site audit distinguish documentation, navigation and external follow-up using one formatter; retained historical facts are not removed or rewritten.

Executed `node tools/run-foundation-tests.mjs --execution-activity-only` against disposable PostgreSQL 18: passed three documentation facts/two selections for three stages, empty/template/repeated/trimmed no-ops, unchanged timestamp/timeline ID preservation, actual timeline reorder/removal, correlated independent audit, payload-free snapshots and the actual activity-page read. Initial test compilation failed on an array/span expression spanning await; corrected the test locals and reran this targeted scope. The final bounded audit primary-key lookup was verified in the same scope.

Frontend: `pnpm --filter @fylkren/web exec vitest run src/components/executionActivityLabel.test.tsx src/components/ActivityTimeline.test.tsx src/workflows/ExecutionWorkflowEditor.test.tsx` passed **8 tests in 3 files**. Web typecheck and documentation links passed. The new tests cover the shared Site-audit/timeline formatter, correlated navigation label, historical missing snapshots, external response, inert step names and generic localized updates.

Source and raw-log hashes are appended to the existing evidence manifest under `executionActivityClarityContinuation`. Logs remain outside the repository. This continuation does not rerun full-product/browser/federation/security/workload qualification, change ASVS statuses, deploy production or claim a navigation-count performance fix. Pending-treatment menu counters are already implemented; their remaining performance qualification is next in the roadmap.


## Navigation-count query performance — 2026-10-04

Targeted continuation from `ce14e17`. `WorkNavigationCountQuery` replaces full card projection/materialization with a database aggregate. The endpoint's authenticated actor, current active Site memberships and shared level authorization are preserved. Dependency blocking, unresolved descendants for assigned/in-progress work, outgoing local/federated request progress, available/claimed planning and execution and exact-level learning retain the prior semantics. The response still contains `tasks`, `planning`, `execution`, `learning`. There is no cache, migration or new count mechanism.

Executed `FYLKREN_NAVIGATION_EVIDENCE_DIR=/tmp/fylkren-navigation-evidence-final node tools/run-foundation-tests.mjs --navigation-counts-only --measure` on disposable PostgreSQL 18. The frozen pre-change implementation and final implementation read the **same** analyzed fixture: the maintained 1,000 registered tasks at Site leadership, plus 180 cases and six cross-site counterparts, three Sites and 27 units. Differential assertions passed leader/planner/member/administrative identities, null leadership, parent-level staff, expired/future roles, foreign membership, dependencies and task hierarchy, local and federated pending/received/terminal/official-answer cases, planning/execution ownership, private learning, immediate Site-membership and role revocation, inactive Sites and unchanged JSON fields. All timed reads returned Tasks **1,075**, Planning **3**, Execution **5**, Learning **28**.

Two rounds reverse before/after order, after warming both query paths and the pool. Each variant has 25 reads per round/concurrency: 150 reads each, 300 total. Timing covers the complete counter database service including authorization and learning reads, without HTTP/proxy overhead. No other workload/browser/edition/federation/security suite was rerun.

| Simultaneous readers | Before p95, round 0 / 1 (ms) | After p95, round 0 / 1 (ms) |
| --- | --- | --- |
| 1 | 403.12 / 413.81 | 16.28 / 16.71 |
| 10 | 698.91 / 701.82 | 24.24 / 25.07 |
| 25 | 1429.09 / 1416.59 | 51.88 / 51.49 |

`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` captures both authorized Site task queries. The prior SQL is 24,422 characters and returns sorted card rows with estimated row width 6,645 bytes. Its larger-Site plan returns 1,040 rows, costs 340,168.5 and executes in 323.309 ms, including 910 JIT functions/261.997 ms compilation. The smaller Site returns 40 rows in 5.623 ms without JIT. New SQL is 2,194 characters; each plan returns one count, width 4 bytes, estimated costs 5,783.99/61.92, execution 1.419/0.273 ms, no JIT. The plan assertions reject report-body projection and sorting in the aggregate. This identifies a cardinality-sensitive mechanism for varied prior results; it does not retrospectively prove the cause of every old HTTP timing.

Frontend navigation label/order tests passed **10 tests in 2 files**. The actual API assembly compiled in the targeted database runner. Completed tests are linked in the canonical architecture traceability; scoped aggregate authorization evidence is appended to ASVS 8.2.1/8.2.2 without promoting their status. The roadmap removes navigation-query optimization from next delivery and puts remaining chapter-1 ASVS work first.

Excluded setup attempts were corrected to respect one leader role per unit, bounded task-reference hierarchy depth, complete peer foreign keys and decimal-valued EXPLAIN row counts. The final full targeted scope and all interleaved measurements passed after correction. Raw SQL/plans/logs stay outside the repository; their hashes and safe plan/measurement summaries are appended to the existing evidence manifest. These are local database measurements with 50 samples per variant/concurrency, not production sizing or a long-running saturation test. Production is untouched.


## Outbound integration boundaries — 2026-10-04

Continuation of ASVS 1.3.3/1.3.6 and affected 1.5.1, based on `f1251f9` plus the changes committed with this record, version `0.70.0-dev.1`. This is scoped integration verification, not final release qualification. All data, keys and credentials were synthetic; disposable local laboratories were removed afterwards. No production deployment or scan was performed.

The shared `OutboundHttpPolicy`/`BoundedResponseHandler` now govern webhook, federation, identity connection tests and OIDC runtime HTTP clients. SAML prepares metadata through the bounded client before initializing Sustainsys, retaining response/assertion signature checks and renewing metadata on demand. Domain/API/federation payloads remain unchanged; internal integrations now require explicit deployment-owned exact origin approvals. Artifact-resolution downloads, automatic HTTP redirects and system proxy routing are disabled. Read the [upgrade/configuration notes](../../operations/INSTALLATION_AND_UPGRADES.md#outbound-integration-configuration).

Executed commands, with `FYLKREN_E2E_API_IMAGE=fylkren-asvs-outbound-api:latest` and `FYLKREN_E2E_WEB_IMAGE=fylkren-automatic-lifecycle-web:latest` for the maintained container laboratories:

```sh
dotnet run --project tests/foundations/Fylkren.FoundationTests.csproj -- --outbound-http-only
node tools/run-identity-sso-lab.mjs --no-build
node tools/run-federation-pair.mjs --outbound-only --no-build
node tools/run-federation-pair.mjs --operational-only --no-build
pnpm check:docs
pnpm check:structure
pnpm check:version
```

The same existing federation laboratory gained an `--outbound-only` mode rather than a separate test system. The API image was built from the final changed API sources. The reused earlier web image supplies unchanged login/gateway behavior; this run does not qualify the latest task/activity UI as part of a full matched release candidate. Immutable image IDs and source/test/log hashes are in the `outboundIntegrationContinuation` section of the [existing evidence manifest](2026-10-02-release-regression-evidence.json).

Observed results:

- Local trusted-TLS tests accepted an explicitly approved exact private origin and ordinary public addresses, and rejected default private/mixed DNS, wrong approved ports, mapped private IPv4, IPv4/IPv6 metadata/link-local/reserved/tunnel/documentation cases, oversized headers and invalid TLS. The first checked connection performed one DNS lookup and connected to the checked IP. Redirect targets received zero requests. Known-length/chunked oversized responses rejected, while the exact byte boundary succeeded.
- SAML cache tests preserved signing keys, accepted signed metadata, reused a valid snapshot under concurrent challenges and refreshed expired cache entries. Changed configuration, wrong IdP identity, expired metadata and failed renewal exposed no stale snapshot. Signed metadata compatibility is not a claim of independent metadata-signature verification.
- Actual OIDC connection tests rejected array metadata and numeric endpoint values with 502. Runtime known-length/chunked oversized bodies, redirects and foreign JWKS origins returned bounded 502 while local administration remained available. Normal authorization-code sign-in, exact issuer/subject binding, state/nonce/audience rejection and replay/lockout guards still passed.
- Actual SAML runtime known-length/chunked oversize, redirect and expired metadata cases rejected with 502. Connection/runtime external/internal DTDs and assertion XXE cases reached zero canaries. Valid signed SSO passed; tampered, unsigned, replayed and double-base64 responses remained rejected. Ordinary session and local administrative routes continued to work during provider failure.
- Actual federation discovery rejected responses over its 16,384-byte operation limit and the 1,000,000-byte client ceiling, redirected responses and an unapproved private origin. Actual webhook delivery acknowledged a 200 response with a body above the federation ceiling without reading it, retained a 302 retry/status and retried an unapproved private receiver without contacting it. Redirect/private-address canary requests: zero.
- Existing operational federation passed signed receipts/retry, activity deduplication, progress/official answer, private-learning boundaries, side/planned requests and cancellation with the same shared transport.

The initial OIDC negatives exposed two transient hardening regressions: the challenge error handler invalidated the initiating local session (next admin read 401), and the library's bare redirect IOException escaped as 500. Final retests passed after preserving local sessions on challenge download failure and explicitly rejecting IdP redirects as controlled HttpRequestException. Early federation fixture failures were missing mounted response files and an incorrect test-client DELETE argument; those fixture defects were corrected before recording successful results.

The repository structure check also found a pre-existing English-source language violation in the execution-label test added earlier. Its synthetic labels/assertions now use the English catalog; product translations were not changed. The invoked frontend test command ran all 161 unit tests in 41 files in about three seconds, all passing. Source structure/language and documentation/security-traceability checks passed. No unrelated whole-product API, backup/restore or browser workflow regression was repeated.

ASVS 1.3.3 is now Passed for the completed dangerous-context limits. ASVS 1.3.6 remains In progress because non-HTTP SMTP/AD/LDAP configured server, DNS/port and referral boundaries still need their own dynamic cases. ASVS 1.4.2 remains open for aggregate totals, date bounds and version/counter increments. Findings SV-065 (HTTP boundary) and SV-066 (typed metadata handling) are closed for the retested scope; the remaining transport work stays on the same matrix row. No retention/deletion behavior changed.


## Non-HTTP service transport continuation — 2026-10-04

Continues ASVS 1.3.6 in requirement order, using the maintained directory/AD laboratories and foundation harness. Baseline `e9b8314` accepted 34 of 36 malformed/reserved SMTP/LDAP/AD server updates with 204; only the two directory newline cases were already rejected. These were configuration-only tests: no cloud metadata request or credential exfiltration was attempted. Final validation rejects all 36 with 400, preserves complete saved configuration snapshots, rejects eight invalid-port and eight invalid-protocol cases, and makes no SMTP connection while validating updates (SV-067).

Shared service-destination preparation validates server syntax, rejects special/reserved literal and DNS addresses, and bounds DNS preflight to ten seconds. SMTP test and queued delivery reuse one preparation helper, retaining the existing queue and audit mechanisms. Explicit private relays/directories remain supported. Native SmtpClient/libldap resolve the name again; this is not socket pinning. SV-068 remains open pending deployment egress enforcement/verification. ASVS 1.3.6 remains incomplete, with this concrete residual finding rather than a passing claim.

The first real StartTLS case returned 502 although a direct trusted-CA `ldapsearch -ZZ` succeeded against the same server. Linux initializes the native destination when connecting, later than the original StartTLS call. The correction establishes a credential-free RootDSE request with AutoBind disabled, negotiates TLS and only then binds credentials; failed preparation disposes the connection (SV-069). This behavior follows the [.NET native target initialization](https://github.com/dotnet/runtime/blob/v10.0.0/src/libraries/System.DirectoryServices.Protocols/src/System/DirectoryServices/Protocols/ldap/LdapConnection.Linux.cs) and [StartTLS implementation](https://github.com/dotnet/runtime/blob/v10.0.0/src/libraries/System.DirectoryServices.Protocols/src/System/DirectoryServices/Protocols/ldap/LdapSessionOptions.cs), with actual container tests as the acceptance evidence.

The initial referral-only provider probe returned 204 with zero referral-canary connections: existing disabled referral chasing worked, but the probe ignored the incomplete search result. Probes now require a complete base entry; lifecycle lookup treats references as unavailable rather than missing (SV-070). The lifecycle negative moves the local account outside the search base, supplies a referral and synchronizes three times: access remains enabled, no receiver is contacted, and subsequent true-missing confirmation begins at its first count after the referral is removed.

Executed scoped commands use `FYLKREN_E2E_API_IMAGE=fylkren-asvs-services-api:latest` and `FYLKREN_E2E_WEB_IMAGE=fylkren-automatic-lifecycle-web:latest`:

```sh
dotnet run --project tests/foundations/Fylkren.FoundationTests.csproj -- --service-transports-only
node tools/run-identity-directory-lab.mjs --transport-only --no-build
node tools/run-identity-directory-lab.mjs --starttls --no-build
node tools/run-identity-ad-lab.mjs --no-build
pnpm check:docs
pnpm check:structure
pnpm check:version
```

The transport slice passed explicit SMTP relay delivery to a recipient-domain-independent target, real delivery from the existing notification worker, rejection of required StartTLS against a plaintext-only relay, and a stalled relay rejected with 502 after 10,035 ms. Trusted LDAPS and StartTLS passed; wrong certificate name, NXDOMAIN and wrong protocol/port failed with 502. The reachable referral canary remained at zero after its reachability control was reset. Foundation tests cover literal/mapped metadata targets, named metadata and mixed DNS preflight, explicit private targets and refusal before native client preparation. They do not simulate or prove protection against native DNS rebinding.

The API image contains the final changed sources; the reused web image supplies unchanged login/gateway behavior. This is affected-transport verification, not a matched full release-candidate qualification. Final image IDs, source/test/log hashes and observed summaries are frozen in `serviceTransportContinuation` in the [existing evidence manifest](2026-10-02-release-regression-evidence.json). Raw synthetic diagnostic logs stay outside Git. Initial fixture errors were an unsupported recipient domain, receiver termination on an intentional socket reset and referral cleanup without ManageDsaIT; corrected fixtures were rerun before recording passing results. No unrelated browser, federation, recovery or whole-product suite was repeated.


## Derived counts and calendar bounds — 2026-10-04

Continues ASVS 1.4.2 after the non-HTTP transport stage. A targeted mode in the existing API runner omits legacy-upgrade, host snapshot and backup/restore chains; fixture bootstrap still uses the maintained actors and authorization helpers. Actual baseline 9f7b484 returned 500 for `to=9999-12-31` in Site audit. A second source-reviewed case was reproduced against the intermediate count candidate: reports accepted year 9999 as input but returned 500 when computing the next year. Both maximum representable calendar bounds now succeed; unrepresentable dates/years are rejected (SV-071).

Source review identified unchecked sums of separate int database counts in mixed audit totals, multi-Site navigation counts and the three-source failed-delivery archive blocker, plus `total + 19` in comment-page calculation (SV-072). These are source/arithmetic findings; no billion-row deployment was constructed or exploit demonstrated. Relevant database queries now return long counts, sums use checked nonnegative arithmetic and ceiling division avoids addition, floating-point conversion and narrowing. Invalid comment pages use the existing shared bounds; valid large pages retain last-page clamping. No schema, authorization, domain-state or external JSON field/number shape changes are introduced.

Scoped commands, using `FYLKREN_E2E_API_IMAGE=fylkren-asvs-arithmetic-api:latest` and the reused `FYLKREN_E2E_WEB_IMAGE=fylkren-automatic-lifecycle-web:latest` for API tests:

```sh
dotnet run --project tests/foundations/Fylkren.FoundationTests.csproj -- --arithmetic-only
node tools/run-foundation-tests.mjs --arithmetic-integration-only
node tools/run-e2e-editions.mjs --asvs-arithmetic-only --no-build
pnpm check:docs
pnpm check:structure
pnpm check:version
```

Boundary tests execute production count helpers with two/three int-max operands, exact long-max success, fail-closed long overflow and negative inputs. Page counts succeed at zero, exact/final pages, int-max and long-max; invalid size/sign inputs reject. These are numerical boundary tests, not claims of large physical database capacity. Actual API cases check three inclusive audit dates, three invalid dates, three report-year boundaries and four invalid years, mixed person/machine audit rows created through authorized APIs, and 21 comments across two pages with five rejected page inputs and preserved Platform Manager denial.

Affected database tests retain the 180-task/six-counterpart navigation fixture across three Sites/27 units, role/hierarchy/membership revocation and exact-level learning. Automatic lifecycle tests retain pending/failed delivery blockers, exact failed-delivery count, concurrent idempotent archive, paused editing, preservation, independent learning and transactional rollback. The initial scoped foundation invocation lacked the migrations normally established by the full runner; adding that same migration prerequisite corrected the fixture, followed by a passing retest. No unrelated whole-product, SSO, federation or browser chain was repeated.

The [existing manifest](2026-10-02-release-regression-evidence.json) freezes `derivedArithmeticContinuation` image/source/test/log hashes and summaries. ASVS 1.4.2 stays In progress: version/revision/security-version and other counter increments, plus remaining derived arithmetic, still require their own boundary tests. This stage does not claim completion of all arithmetic or full release qualification.


## Version and retry counter bounds — 2026-10-04

Continues ASVS 1.4.2. Against baseline f581c73 a real LoginIdentity at long.MaxValue accepted a password-hash change and wrapped SecurityVersion to long.MinValue. This was a synthetic in-memory boundary test, not a replayed session or production-scale operation (SV-073). Checked next-version calculation now rejects exhausted or negative versions before changing domain fields. The existing exception handler returns 409 / numeric_capacity_exceeded for affected API mutations; ordinary API/federation payloads and immutable history remain compatible. No schema, retention execution or persistent deletion is introduced.

The existing runners provide scoped commands:

```sh
dotnet run --project tests/foundations/Fylkren.FoundationTests.csproj -- --version-boundaries-only
node tools/run-foundation-tests.mjs --version-integration-only
node tools/run-e2e-editions.mjs --asvs-version-only --no-build
node tools/run-federation-pair.mjs --outbound-only --no-build
node tools/run-identity-ad-lab.mjs --no-build
```

The Docker runners use FYLKREN_E2E_API_IMAGE=fylkren-asvs-versions-api:latest and the reused FYLKREN_E2E_WEB_IMAGE=fylkren-automatic-lifecycle-web:latest. All commands passed. The reused web is an unchanged gateway, not qualification of the latest complete UI/release candidate.

- Twenty actual domain mutations accept their last version and reject exhaustion with unchanged state: identity security versions, information lifecycle, Site settings, learning, archive grants, export acknowledgement, federation publication and projection/webhook attempts. Negative helper versions reject; maximum-version no-ops remain no-ops. Authentication failures saturate at the existing 20 threshold, notification retries at five and directory missing confirmations at their configured threshold. Ordinary threshold sequences and seeded int-max counters pass.
- Database tests accept the last formal approval number, reject the next approval without added version/signoff/audit rows, and preserve immutable history. Atomic SQL webhook claiming increments int-max-minus-one once; exhausted or negative attempts acquire no lease and change no state.
- API tests reject Site versions at long-max and long-max-minus-one without saving either partial update; reject exhausted sibling ordering without adding a unit; preserve ordinary decision/risk/measure revisions and PlatformManager authorization. Exhausted risk/measure revisions return 409 and preserve their full retained histories. Historical capacity rows are inserted as synthetic fixtures, not rewritten.
- Affected domain coverage, governance, preservation and automatic-lifecycle database cases pass, including audit/activity rollback and archive/delivery gates. Existing outbound webhook/federation boundary and live Samba AD suspension/session-revocation/restoration/outage tests pass. This is affected-scope regression, not the complete product suite.

Safe source/image/log hashes are appended under versionCounterContinuation in the [existing evidence manifest](2026-10-02-release-regression-evidence.json). Raw logs and fixture credentials stay outside Git. ASVS 1.4.2 remains In progress pending ZIP64 declared-length aggregation and the remaining arithmetic inventory; security-version boundary coverage does not complete session-management requirements. Native DNS finding SV-068 remains open independently.


## ZIP64 declared-length boundaries — 2026-10-04

Continues ASVS 1.4.2 and retests affected 1.5.2 parser controls. A tiny ZIP64 fixture with two long-max declared lengths returned API 500 on 6c6519e / fylkren-asvs-versions-api:latest: Enumerable.Sum overflowed before the package-size rejection. No large data was allocated or extracted and no availability/exfiltration impact beyond this failed request was demonstrated (SV-074). The validator now rejects excessive entry counts immediately and checks every declared length against the remaining existing 512 MiB allowance before addition or opening entries. Existing import validation remains read-only.

Commands passed:

```sh
dotnet run --project tests/foundations/Fylkren.FoundationTests.csproj -- --zip-length-only
FYLKREN_E2E_API_IMAGE=fylkren-asvs-zip-api:latest FYLKREN_E2E_WEB_IMAGE=fylkren-automatic-lifecycle-web:latest node tools/run-e2e-editions.mjs --asvs-zip-only --no-build
```

Five small ZIP64 cases exercise signed aggregate overflow, unsigned maximum, aggregate one byte above policy, exact policy limit and zero. Foundation tests assert the real ZipArchive reader exposes the declared 64-bit lengths. Oversized input returns bounded validation errors; exact-limit/zero input reaches missing-manifest validation without extraction. Actual API cases return 200 / valid:false without exception details. An unchanged current Site export validates successfully, three literal metadata cases and ignored client type markers remain accepted, and all 20 maintained malformed manifest cases reject with bounded results. ASVS 1.5.2 was reopened while its changed parser control was unverified and returns to Passed after these retests.

The same [evidence manifest](2026-10-02-release-regression-evidence.json) records zipLengthContinuation baseline/candidate hashes and results. ASVS 1.4.2 remains In progress: the remaining arithmetic review identified separate SQL authentication-failure/federation-delivery increments and federation grant revisions needing their own boundary tests. This stage does not qualify those paths or the complete release; production is untouched.

## SQL authentication and federation counter bounds — 2026-10-04

Continues ASVS 1.4.2. Against f071c9a, an actual failed login with a synthetically seeded int-max failure count returned 500 from PostgreSQL integer overflow. A real FederationSiteGrant seeded at long-max changed active state and wrapped its revision negative. Source review also found the federation delivery SQL claim incremented without its existing six-attempt terminal bound. These are synthetic boundary cases; no authentication bypass, session replay or production-scale counter exhaustion was demonstrated (SV-075).

Failed-login SQL now saturates atomically at the existing count 20 and sets the existing 15-minute lock. Federation grant revision uses the common checked next-version calculation before state mutation. The existing federation outbox remains authoritative; its atomic claim now permits attempts zero through five and refuses negative or terminal counters without acquiring a lease. No schema, broker, event store, audit replacement or API payload change is introduced.

Scoped tests passed:

```sh
dotnet run --project tests/foundations/Fylkren.FoundationTests.csproj -- --version-boundaries-only
node tools/run-foundation-tests.mjs --version-integration-only
FYLKREN_E2E_API_IMAGE=fylkren-asvs-counter-api:latest FYLKREN_E2E_WEB_IMAGE=fylkren-automatic-lifecycle-web:latest node tools/run-e2e-editions.mjs --asvs-counter-only --no-build
FYLKREN_E2E_API_IMAGE=fylkren-asvs-counter-api:latest FYLKREN_E2E_WEB_IMAGE=fylkren-automatic-lifecycle-web:latest node tools/run-federation-pair.mjs --outbound-only --no-build
```

The 21 domain cases accept their last revision and reject exhaustion unchanged. Database tests prove webhook and federation claims accept their last attempt and reject negative/exhausted counters without lease or state changes. Actual login tests prove int-max saturation, correct-password rejection during lock, three concurrent failures saturating at 20 and successful login/reset of the counter after lock expiry. The maintained outbound integration suite passes its delivery, size, redirect, private-origin and zero-canary assertions. The reused web image is an unchanged gateway, not full UI/release qualification. Safe hashes are stored under `sqlFederationCounterContinuation` in the existing evidence manifest; raw logs and synthetic credentials remain outside Git. Production is untouched.

ASVS 1.4.2 remains In progress for bounded pagination/count paths and the final arithmetic inventory. Native DNS finding SV-068 remains open independently.

## Final pagination and arithmetic inventory — 2026-10-04

Completes the reviewed application scope for ASVS 1.4.2 after the preceding derived, version, ZIP64 and SQL-counter stages. Source inventory found remaining unbounded database totals and grouped counts represented as 32-bit values across Site lifecycle impact, Site audit, learning, report archives/API, SMTP status, platform/Site users, webhook/federation delivery status and planning/execution queues. These were source-level capacity risks; no billion-row database or resulting production failure was constructed. They now use translated 64-bit counts. Total pages and focus ranks use exact integer division without floating-point conversion, narrowing or addition overflow; requested page and page size remain capped by the existing shared policy.

Remaining arithmetic hits were individually classified: retention-policy versions are rejected at 1,000 before increment; workflow steps/templates and bulk user IDs are limited to 30/200; activity/archive lookahead adds one only to bounded sizes; rate-limit retry intervals are fixed at one minute; current-time federation windows cannot approach long extrema; in-memory collection and byte-array lengths are already int-bounded and their maximum configured entry counts keep long sums below overflow; TOTP shifts are intentional cryptographic encoding. Notification failure logging now records the already saturated domain attempt rather than computing a second unchecked display value.

Scoped commands passed:

```sh
dotnet run --project tests/foundations/Fylkren.FoundationTests.csproj -- --arithmetic-only
node tools/run-foundation-tests.mjs --arithmetic-integration-only
FYLKREN_E2E_API_IMAGE=fylkren-asvs-pagination-api:latest FYLKREN_E2E_WEB_IMAGE=fylkren-automatic-lifecycle-web:latest node tools/run-e2e-editions.mjs --asvs-arithmetic-only --no-build
```

Production helpers pass combined int-max counts, long-max totals/pages/focus indices, exact boundary transitions and rejected negative/zero/overflow inputs. Database tests preserve automatic lifecycle blockers and exact navigation counts. The API run accepts pages 1 and 1,000,000 on ten endpoints, rejects 57 invalid/overflow cases, verifies inclusive maximal dates, years 1900/9998/9999, mixed audit totals, 21-row page boundaries and authorization. The API image is `sha256:6360b8b6eec4544f4528893dac857ad6de778aa517758e6a6af1d3ca8060ab55`; the reused web image remains an unchanged gateway and is not final UI qualification.

The [existing evidence manifest](2026-10-02-release-regression-evidence.json) records `paginationArithmeticContinuation` source/image/log hashes and the source-review classification. ASVS 1.4.2 is Passed for this scope. This does not claim billion-row load testing, dependency-level arithmetic review or complete ASVS certification. The next requirement in matrix order is 2.1.1; native DNS finding SV-068 remains open independently. Production is untouched.

## Input-validation documentation — 2026-10-04

Completes ASVS 2.1.1. The new [authoritative rule document](../../security/INPUT_VALIDATION.md) records the API as the trusted boundary, the decode/normalize/structure/relationship/authorization/transaction order, safe failure semantics and expected structures for every major input class. It links rules to their shared or domain production validators and maintained tests. It is a design reference, not a second ASVS matrix or status list.

The existing API runner received a targeted `--asvs-input-only` path that skips legacy-upgrade and backup/restore chains while retaining normal actor/Site/role bootstrap. Against `fylkren-asvs-pagination-api:latest`, it passed 57 rejected numeric cases across ten paged APIs, nine rejected links, nine rejected CSS values without saved mutation, seven literal stored payloads, two single-JSON-decode cases, three literal portable metadata cases, 20 malformed manifest cases and ignored client `$type` metadata. Valid pagination limits and four allowed link schemes still pass. Documentation links, ASVS traceability, source structure and repository language checks pass.

The [evidence manifest](2026-10-02-release-regression-evidence.json) records `inputValidationDocumentationContinuation` hashes and scope. ASVS 2.1.1 is Passed; this documentation result does not by itself pass 2.1.2/2.1.3 or every input-validation implementation requirement. Continue at 2.1.2. Production is untouched.

## Contextual input validation — 2026-10-04

Completes ASVS 2.1.2 by pairing the documented combined-data rules with a focused API run. The existing disposable Site/leader bootstrap creates two tasks, then tests related values without executing the full operational chain. Self-dependency, duplicate dependency and the reverse edge that would create a cycle all reject; exactly one valid edge remains. A request with conflicting recipient fields rejects. Three incomplete or out-of-range residual-risk pairs reject without creating a risk, while a complete pair persists with the expected score. Invalid decision-maker and object-reference relationships reject without decision/history side effects, while the valid member/reference form persists.

Command:

```sh
FYLKREN_E2E_API_IMAGE=fylkren-asvs-pagination-api:latest FYLKREN_E2E_WEB_IMAGE=fylkren-automatic-lifecycle-web:latest node tools/run-e2e-editions.mjs --asvs-context-only --no-build
```

The API image is unchanged from the completed arithmetic stage; only the focused maintained test path is added. Safe hashes and results are stored under `contextualValidationContinuation` in the existing evidence manifest. ASVS 2.1.2 is Passed; this does not pass the separate global/per-user business-limit requirement 2.1.3 or all implementation-level validation requirements. Continue at 2.1.3. Production is untouched.

## Business-limit documentation — 2026-10-04

Completes ASVS 2.1.3. The authoritative [input-validation rules](../../security/INPUT_VALIDATION.md#business-limits-and-scope) now separate per-command, local-account, client-address, machine-identity, federation-client, Site/edition and installation-wide limits. The documented values are tied to the production policies that enforce them. Areas without a current product quota are stated directly: Fylkren has no per-account creation quota for ordinary domain objects and no installation-wide total-data quota. Those are retained as incomplete anti-automation scope under ASVS 2.4.1 rather than presented as verified controls.

The focused command passed against the unchanged arithmetic candidate:

```sh
FYLKREN_E2E_API_IMAGE=fylkren-asvs-pagination-api:latest FYLKREN_E2E_WEB_IMAGE=fylkren-automatic-lifecycle-web:latest node tools/run-e2e-editions.mjs --asvs-limits-only --no-build
```

The test starts before synthetic user bootstrap so earlier authentication calls cannot consume the same client-address partition. It verifies generic and cache-resistant unknown/oversized identity failures, then the documented fixed-window limit with `429` and numeric `Retry-After`. The first runner attempt reached `429` before the expected baseline because setup had already consumed the shared partition; no product defect was inferred, and the maintained scoped runner was corrected before the passing rerun.

ASVS 2.1.3 is Passed as a documentation requirement. The result does not pass ASVS 2.4.1, distributed guessing, account/client combined throttling, global storage capacity, or the complete release candidate. Safe hashes and results are recorded under `businessLimitDocumentationContinuation` in the [existing evidence manifest](2026-10-02-release-regression-evidence.json). Continue at 2.2.1. Production is untouched.

## Query-input validation — 2026-10-04

Continues ASVS 2.2.1 without marking it complete. Source inventory of query-bound endpoint parameters found that page/search bounds were generally shared, but unsupported filter, sort, view, area, kind, priority and log-level values could silently select a default. People and dependency searches lacked the documented 200-character ceiling, technical-log limits were silently clamped and Site audit accepted a reversed period. These authorized requests did not expand the caller's data scope or demonstrate service failure (SV-076).

The shared query policy now supplies explicit choice, maximum-length and result-limit checks. Ten endpoint families apply their own positive allowlists and existing authorization remains independent. The focused command used a newly built API image and the unchanged web gateway:

```sh
FYLKREN_E2E_API_IMAGE=fylkren-asvs-query-api:latest FYLKREN_E2E_WEB_IMAGE=fylkren-automatic-lifecycle-web:latest node tools/run-e2e-editions.mjs --asvs-query-only --no-build
```

Twenty negative cases reject unsupported choices, oversized event/search input, reversed audit dates and invalid log limits. Eight documented positive combinations still return 200. The dependency-search case creates one disposable task and proves its oversized input is rejected after normal authorization and lifecycle checks. API compilation and runner syntax checks pass. The image is `sha256:1bc6249515e33704232d787e3cf5ca2cd292890c8ecc68a17fe0771060fafdb6`; the reused web image remains an unchanged gateway.

ASVS 2.2.1 remains In progress because the full request-body, header and file-input inventory is not yet complete. Safe hashes and results are recorded under `queryInputValidationContinuation` in the existing evidence manifest. Production is untouched.

## Request-body shape validation — 2026-10-04

Continues ASVS 2.2.1 without marking it complete. The focused baseline against `fylkren-asvs-query-api:latest` reproduced HTTP 500 when a Site Manager supplied a valid workflow-template name with `content: null`. Related source review found unguarded null collection elements in workflow steps, planning allocations, planning/execution timeline values, decision references and learning points. Webhook configuration also dereferenced required nullable body values, while machine-client scope input silently removed null elements. No unauthorized access or partial write was demonstrated (SV-077).

Required template/webhook values and fixed object collections now reject null before dereference or domain construction. Webhook names and URLs are bounded to their persisted limits. The focused retest used:

```sh
FYLKREN_E2E_API_IMAGE=fylkren-asvs-body-api:latest FYLKREN_E2E_WEB_IMAGE=fylkren-automatic-lifecycle-web:latest node tools/run-e2e-editions.mjs --asvs-body-only --no-build
```

Seven malformed HTTP bodies return 400: null template content, a null workflow step, a mixed null machine scope, and three null webhook field/element forms, plus a null decision reference. The decision case confirms no revision persisted. Compilation completes with zero warnings/errors. Source guards also cover the homologous planning, execution and learning collection paths; those deeper operational paths retain their existing functional tests and remain part of the continuing full input inventory rather than being claimed as seven additional dynamic cases.

The API image is `sha256:0525d44d4f44f2a8639c179bd9594ca0fd943fd7fdd55286eacaefb4daee88e1`; the reused web is unchanged. ASVS 2.2.1 remains In progress for remaining body fields, headers and file inputs. Safe hashes and results are recorded under `requestBodyShapeContinuation` in the existing evidence manifest. Production is untouched.

## Header and file input validation — 2026-10-04

Continues ASVS 2.2.1 without marking it complete. Header and file source inventory confirmed bounded Bearer parsing, `Idempotency-Key` allowlisting, numeric `If-Match` parsing and image signature/type/size validation. It also found two inconsistent input boundaries. The administration Site list silently clamped invalid `limit` values (SV-078). Portable import advertised a 512 MiB package ceiling, while the gateway and API global 3 MiB request ceilings made that validator unreachable for larger admissible packages (SV-079). Baseline runs against the preceding API/web candidates reproduced HTTP 200 for `limit=0` and HTTP 413 for a 4 MiB multipart package.

The shared query validator now rejects invalid administration limits. The general 3 MiB request ceiling remains; only the UUID-shaped portable import-validation route receives 513 MiB capacity for multipart overhead, while the endpoint continues to reject files above 512 MiB and the existing ZIP entry/count/integrity limits remain unchanged. The focused retest used:

```sh
FYLKREN_E2E_API_IMAGE=fylkren-asvs-header-file-api:latest FYLKREN_E2E_WEB_IMAGE=fylkren-asvs-header-file-web:latest node tools/run-e2e-editions.mjs --asvs-header-file-only --no-build
```

The run rejects four invalid machine API limits, accepts both documented boundaries, rejects a logo one byte above 2 MiB and sends a 4 MiB invalid ZIP through the intended validator, which returns a bounded invalid result. API compilation completed with zero warnings/errors and the gateway candidate passed its Compose health check. The API image is `sha256:ae67605e2bb6077d3a72f29aa98d681c1e081da0559ab71abc248f245cbe0a38`; the web image is `sha256:2806135f53e64aaa7c63bcf2ff2e75933bb963361a42243bff84e2b512ae38e7`.

ASVS 2.2.1 remains In progress for the remaining request-body field inventory. Safe hashes and results are recorded under `headerFileInputValidationContinuation` in the existing evidence manifest. Production is untouched.

## Request-body contract inventory completion — 2026-10-04

Completes ASVS 2.2.1. The source inventory reviewed 106 API request/payload contract declarations and their server-side consumers after the separate query and header/file passes. The baseline candidate reproduced HTTP 500 for an authenticated Platform Manager bulk-password request containing `personIds: null` (SV-080). The same inspection found that a null element in a federation capability type list could be dereferenced during positive validation, and that directory-user identifiers could reach provider lookup without local presence/length bounds. No unauthorized action or partial persistence was observed.

The shared bulk-user validator now rejects a null collection before enumeration, covering password reset, assignment and cleanup. Federation capability validation rejects null collections and elements before canonicalization or signature decisions. Directory-user creation bounds provider identifiers and usernames before external provider access. The focused API retest used:

```sh
FYLKREN_E2E_API_IMAGE=fylkren-asvs-body-complete-api:latest FYLKREN_E2E_WEB_IMAGE=fylkren-asvs-header-file-web:latest node tools/run-e2e-editions.mjs --asvs-body-only --no-build
dotnet run --project tests/foundations/Fylkren.FoundationTests.csproj --no-restore -- --input-validation-only
```

Eight malformed HTTP bodies now return 400, including the reproduced null bulk collection; the decision case remains atomic. The focused foundation test accepts a valid capability offer and rejects null schema/type collections plus a null type element without throwing. API compilation completed with zero warnings/errors. The API image is `sha256:9bbfe923bfc4d302051eec8cfffa47f94e0a64da30fcbc1d66439828bcb076d2`; the gateway image remains `sha256:2806135f53e64aaa7c63bcf2ff2e75933bb963361a42243bff84e2b512ae38e7`.

Together with the prior query, contextual, arithmetic, header, file, portable-parser and body-shape evidence, this closes the complete input inventory and marks ASVS 2.2.1 Passed. It does not by itself pass the distinct trusted-layer requirement 2.2.2 or complete release qualification. Safe hashes and results are recorded under `bodyContractInventoryCompletion` in the existing evidence manifest. Production is untouched.

## Trusted service-layer validation — 2026-10-04

Completes ASVS 2.2.2 by reviewing where the validations established under 2.2.1 execute. Query choices and ranges use API policies; request bodies are checked in endpoint/service code before mutation; file content is checked by server readers; federation payloads are checked before signature-dependent processing; domain constructors and database constraints retain invariant backstops. Browser validation remains a usability aid.

The negative test clients construct raw JSON, query strings, headers and multipart bodies and call the gateway/API directly. They do not render or submit React forms. The current focused body and header/file runs therefore demonstrate rejection with client-side validation completely bypassed. The capability test calls the trusted protocol validator directly. No additional product change or broad rerun was needed for this distinct architecture placement check.

ASVS 2.2.2 is Passed. This conclusion is limited to the completed 2.2.1 input inventory and does not pass related-data combinations under 2.2.3 or complete release qualification. Source hashes and reused current-candidate results are recorded under `trustedServiceValidationCompletion` in the existing evidence manifest. Production is untouched.

## Related-data combination validation — 2026-10-04

Completes ASVS 2.2.3. The related-field inventory followed the same 106 request/payload contracts and grouped the rules that only make sense together: identity names/passwords; hierarchy placement and exclusive leadership; role time periods and overlap; recipient/site/instance selection; workflow step/unit allocation; dependency graphs; initial/residual risk pairs and ownership; decision actors/references; federation identity, sequence and message relationships; lifecycle stage/version/hold/custody; and portable package identifiers, relationships, versions and hashes.

The current focused command was:

```sh
FYLKREN_E2E_API_IMAGE=fylkren-asvs-body-complete-api:latest FYLKREN_E2E_WEB_IMAGE=fylkren-asvs-header-file-web:latest node tools/run-e2e-editions.mjs --asvs-context-only --no-build
```

It rejected three invalid dependency relationships, a conflicting local recipient pair, three incomplete/out-of-range residual risk pairs and two invalid decision relationships. Rejected commands left dependency graphs, risk lists and decision history unchanged, while valid related values persisted. Maintained dependency, transition, administration, federation and portability tests provide the remaining category evidence, including hierarchy/period conflicts, sender/recipient identity and replay relationships, and cross-Site/package integrity.

ASVS 2.2.3 is Passed. The focused result and maintained source hashes are recorded under `relatedDataValidationCompletion` in the existing evidence manifest. This does not pass sequence enforcement under 2.3.1 or complete release qualification. Production is untouched.

## Business-flow sequence enforcement — 2026-10-04

Completes ASVS 2.3.1. The sequence inventory covers local authentication reset and MFA grants; WorkItem review, planning, routing, execution and final reporting; reversible lifecycle stage/version/hold/custody transitions; machine-request idempotency/version checks; and federated sender, receiver, message-sequence and replay state. Domain objects remain authoritative, and every reviewed sequence is enforced in the API/domain layer rather than by the browser.

The focused raw-API command was:

```sh
FYLKREN_E2E_API_IMAGE=fylkren-asvs-body-complete-api:latest FYLKREN_E2E_WEB_IMAGE=fylkren-asvs-header-file-web:latest node tools/run-e2e-editions.mjs --asvs-sequence-only --no-build
```

It rejects six direct WorkItem status skips and confirms rejected transitions leave the item registered. It also rejects final-report write and approval before review, execution submission before start, starting the same execution twice, completion before a saved and approved report, approval without a report, duplicate approval and reopening a completed task. The valid registered → under review → execution → claimed → started → submitted for review → report saved → report approved → completed sequence passes.

Maintained transition and dependency suites cover plan claim/submit/approve/release, hold/reopen, blocked work, report return, reassignment and cancellation. Maintained identity, lifecycle and federation suites cover their sequence-specific grants, versions, replay barriers and terminal states. The focused test result is `{"businessFlowSequence":"passed","rejectedStatusSkips":6,"prematureReportActionsRejected":4,"executionOrderRejections":2,"duplicateApprovalRejected":true,"terminalReopenRejected":true}`.

ASVS 2.3.1 is Passed. Safe hashes and the unchanged candidate image IDs are recorded under `businessFlowSequenceCompletion` in the existing evidence manifest. This result does not pass business-limit enforcement under 2.3.2, concurrency/atomicity requirements or complete release qualification. Production is untouched.

## Business-limit enforcement — 2026-10-04

Completes ASVS 2.3.2 by comparing every row in the authoritative [business-limit table](../../security/INPUT_VALIDATION.md#business-limits-and-scope) with production enforcement and executed tests. Per-command text, collection, byte and package limits already passed in the completed 2.2.1 inventory, including atomic rejection. Existing focused runs verify 20 failed password checks with saturating lockout, one-time identity operations and the eight-per-minute authentication-client partition. The current federation evidence verifies its 20-request partitions plus body, response and retry ceilings.

Two focused commands filled the remaining dynamic gaps:

```sh
FYLKREN_E2E_API_IMAGE=fylkren-asvs-body-complete-api:latest FYLKREN_E2E_WEB_IMAGE=fylkren-asvs-header-file-web:latest node tools/run-e2e-editions.mjs --asvs-business-limits-only --no-build
FYLKREN_E2E_API_IMAGE=fylkren-asvs-body-complete-api:latest FYLKREN_E2E_WEB_IMAGE=fylkren-asvs-header-file-web:latest node tools/run-e2e-editions.mjs --asvs-community-limit-only --no-build
```

Separate machine identities each receive the documented 30 writes and 120 reads in a fixed minute; the next request returns `429` with numeric `Retry-After`. A clean Community fixture accepts three active Sites, rejects a fourth with `community_site_limit` without changing the count, then accepts a replacement after one Site is deactivated. The production policies centralize the same values used by UI and machine Site creation.

ASVS 2.3.2 is Passed. The documentation explicitly says Fylkren has no per-account quota for ordinary object creation and no installation-wide data-set quota. Those missing anti-automation/capacity controls remain under 2.4.1 and release sizing; they are not counted as implemented limits here. Safe hashes and unchanged candidate image IDs are recorded under `businessLimitEnforcementCompletion` in the existing evidence manifest. This result does not pass transaction/concurrency requirements or complete release qualification. Production is untouched.

## Business transaction boundaries — 2026-10-04

Completes ASVS 2.3.3. The source inventory covers 204 application `SaveChangesAsync` call sites and 38 explicit `BeginTransactionAsync` sites. The shared DbContext gives each logical save a database transaction that includes reference allocation, authoritative state, security audit, canonical activity, notification projection and automatic lifecycle work. Explicit transactions surround read-lock-write decisions, repeatable portability snapshots, one-time identity/federation consumption and operations containing more than one save. Webhook, SMTP and federation network delivery use durable outbox/lease states so an external call is not falsely presented as rollback-capable database work.

The review found one unnecessary split in ordinary local login (SV-081): correct-password cleanup/password rehash state was committed before the successful-sign-in timestamp. No session was issued between these commits, but a database failure could leave partial bookkeeping. Non-MFA login now records both changes in one save; MFA retains one save before returning the protected second-factor challenge. The API build completed with zero warnings/errors. The focused current-image retest passed saturated/concurrent authentication failures, active lock enforcement and successful login/reset after expiry:

```sh
FYLKREN_E2E_API_IMAGE=fylkren-asvs-transactions-api:latest FYLKREN_E2E_WEB_IMAGE=fylkren-asvs-header-file-web:latest node tools/run-e2e-editions.mjs --asvs-counter-only --no-build
node tools/run-foundation-tests.mjs
```

The database suite proves rollback across WorkItem state, security audit, canonical activity, notification projections, risk/revisions, automatic terminal lifecycle, export receipts and preservation evidence. It also passes projection lease concurrency, immutable history, consumer reconciliation and repeatable export snapshots. The first foundation attempt stopped because a portable negative fixture set an already-null optional policy ID to null; the test now creates the intended invalid pair, policy version without policy ID. The corrected full run passes, and this was a test-fixture defect rather than an accepted package.

ASVS 2.3.3 is Passed. Safe source/image hashes and the focused outcomes are recorded under `businessTransactionCompletion` in the existing evidence manifest. This result does not pass limited-resource locking under 2.3.4 or complete release qualification. Production is untouched.

## Limited-resource locking — 2026-10-04

Completes ASVS 2.3.4. The limited-resource inventory covers one-time password reset and MFA recovery grants; WebAuthn registration/login state; Community Site capacity; planning and execution ownership; human-readable reference allocation; activity projection leases; webhook and federation delivery claims; inbound federation receipts; and machine-request idempotency. The implementation uses conditional updates, transaction/advisory locks, optimistic row versions and uniqueness constraints at the authoritative database boundary.

The baseline test found SV-082: concurrent execution claims persisted exactly one owner through `IX_execution_runs_work_item_id`, but the losing request returned HTTP 500 because that known uniqueness collision was absent from the central concurrency mapping. The handler now returns bounded `409 concurrency_conflict`. No double booking or unauthorized ownership was observed. The focused retest used:

```sh
FYLKREN_E2E_API_IMAGE=fylkren-asvs-locking-api:latest FYLKREN_E2E_WEB_IMAGE=fylkren-asvs-header-file-web:latest node tools/run-e2e-editions.mjs --asvs-locking-only --no-build
FYLKREN_E2E_API_IMAGE=fylkren-asvs-locking-api:latest FYLKREN_E2E_WEB_IMAGE=fylkren-asvs-header-file-web:latest node tools/run-e2e-editions.mjs --asvs-community-limit-only --no-build
```

Two separately authenticated users concurrently claim the same planning run and execution item. Each path returns exactly `204/409`, and the persisted queue has one owner. Two concurrent Site creates competing for the final Community slot return `201/409`; the active count remains three, and deactivation releases a replacement slot. Maintained identity and WebAuthn tests already prove exactly one successful concurrent reset/factor consumption. Foundation and federation suites cover projection/delivery leases, idempotency, deduplication and exactly one terminal outcome.

The API builds with zero warnings/errors. The tested API image is `sha256:e9612f18d3b8004ff4be58e572a2d6faf4b2a5fecbba607a76b915471ffec989`; the unchanged web gateway is `sha256:2806135f53e64aaa7c63bcf2ff2e75933bb963361a42243bff84e2b512ae38e7`. ASVS 2.3.4 is Passed. Safe hashes and focused outcomes are recorded under `limitedResourceLockingCompletion` in the evidence manifest. This does not pass anti-automation requirement 2.4.1 or complete release qualification. Production is untouched.

## Anti-automation controls — 2026-10-04

Completes ASVS 2.4.1. The inventory retained existing stricter limits for authentication clients, machine identities and federation protocol callers but found no common ceiling for ordinary authenticated API traffic or several costly export and external-integration operations (SV-083). Authorization and per-command validation remained effective, but an authorized account could automate excessive reads, garbage writes, package generation or network probes.

The common limiter now partitions authenticated browser traffic by person, machine traffic by machine identity and anonymous traffic by the trusted client-address boundary. It permits 600 reads and 120 mutating requests per fixed minute; health checks remain unthrottled for monitoring. Export and remote federation discovery/synchronization permit six calls per identity/client per minute. Portable import validation and explicit provider/directory/SMTP tests have separate 30-call ceilings because each call retains its own byte/time/destination controls and the maintained negative security suites require more than six cases. Every rejection uses `429` and numeric `Retry-After`.

The focused commands were:

```sh
FYLKREN_E2E_API_IMAGE=fylkren-asvs-automation-api:latest FYLKREN_E2E_WEB_IMAGE=fylkren-asvs-header-file-web:latest node tools/run-e2e-editions.mjs --asvs-automation-only --no-build
FYLKREN_E2E_API_IMAGE=fylkren-asvs-automation-api:latest FYLKREN_E2E_WEB_IMAGE=fylkren-asvs-header-file-web:latest node tools/run-e2e-editions.mjs --asvs-input-only --no-build
```

Isolated authenticated identities exhaust the read partition after 599 test reads plus their setup read, the mutation partition after 120 requests and the costly export partition after six successful packages. Every next request returns `429` with `Retry-After`. The existing input run still passes nine CSS and nine link rejections, seven stored payloads, 20 malformed portable manifests and 57 numeric cases, proving that the bounded-upload policy does not hide parser coverage. The API builds with zero warnings/errors.

The tested API image is `sha256:278bc753880ead9950b1af0fd1366942198c0ba343d329a39e794c429e3bd13a`; the unchanged web gateway is `sha256:2806135f53e64aaa7c63bcf2ff2e75933bb963361a42243bff84e2b512ae38e7`. ASVS 2.4.1 is Passed. Lifetime installation storage capacity remains documented deployment/release sizing work and is not represented as unlimited scale. Safe hashes and outcomes are recorded under `antiAutomationCompletion` in the evidence manifest. Production is untouched.

## Unintended content interpretation — 2026-10-04

Completes ASVS 3.2.1. The response/file inventory found JSON API responses, validated PNG/JPEG/WebP profile and branding images, and generated portable ZIP packages. Fylkren does not expose uploaded HTML, SVG or arbitrary attachments as browser resources. The gateway applies `nosniff`, frame denial and CSP with `object-src 'none'`, `frame-ancestors 'none'` and `base-uri 'none'`; the API supplies equivalent direct-access safeguards. Generated ZIP files already use an attachment filename.

The focused current-candidate command was:

```sh
FYLKREN_E2E_API_IMAGE=fylkren-asvs-automation-api:latest FYLKREN_E2E_WEB_IMAGE=fylkren-asvs-header-file-web:latest node tools/run-e2e-editions.mjs --asvs-content-context-only --no-build
```

Three cross-Site requests advertise `script`, `style` and `document` destinations. Each JSON response remains `application/json`, has `X-Content-Type-Options: nosniff` and receives the restrictive gateway CSP. Active HTML submitted as `image/png` is rejected before persistence; a valid one-pixel PNG is returned as `image/png` with `nosniff`. A Site export requested as document navigation is returned as `application/zip` with `Content-Disposition: attachment`. All cases pass without a product change.

The API image remains `sha256:278bc753880ead9950b1af0fd1366942198c0ba343d329a39e794c429e3bd13a`; the gateway image remains `sha256:2806135f53e64aaa7c63bcf2ff2e75933bb963361a42243bff84e2b512ae38e7`. ASVS 3.2.1 is Passed. Safe hashes and results are recorded under `contentInterpretationCompletion` in the evidence manifest. This does not pass the distinct output-context inventory under 3.2.2 or complete release qualification. Production is untouched.

## Safe text output contexts — 2026-10-04

Completes ASVS 3.2.2. The frontend source inventory searched all TypeScript/TSX for direct HTML/DOM fragment insertion, script evaluation, URL assignment, inline style construction and print-frame generation. There is no `dangerouslySetInnerHTML`, `document.write`, arbitrary DOM parser or executable string sink. Ordinary user/domain strings are React children or attributes and receive React escaping.

Rich text is a small structural renderer that emits React headings, lists, paragraphs and text. The content editor's only `innerHTML` assignments receive `markdownToEditorHtml`, which escapes `&`, `<`, `>` and quotes before emitting the fixed element set; paste and drop use plain-text insertion. The report print frame clones already rendered DOM. Its language, title and classification-to-CSS inputs are encoded independently. Work links and customer CSS are separate URL/style contexts with server allowlists and existing negative tests.

The focused current-source command was:

```sh
pnpm --filter @fylkren/web test
```

All 41 test files and 161 tests pass. These include literal/double-encoded script, image, event-handler, template-expression and JavaScript-URL text in rich content; comment and activity attribution; classification inside generated print CSS; and report rendering. The maintained Chromium run additionally proves stored active-content text and editor paste/drop remain inert. No product correction was required.

ASVS 3.2.2 is Passed. Safe source hashes and results are recorded under `safeTextOutputCompletion` in the evidence manifest. This does not pass cookie controls under 3.3.1 or complete release qualification. Production is untouched.

## Secure host cookie setup — 2026-10-04

Completes ASVS 3.3.1 and 3.3.3 and refreshes the already-passed 3.3.2/3.3.4 evidence. The focused fixture enables the production HTTPS and trusted-forwarder settings while keeping the disposable gateway/API network local. It sends forwarded HTTPS requests directly from the API container and inspects the unmodified `Set-Cookie` headers, avoiding a browser cookie jar that might normalize attributes.

```sh
FYLKREN_E2E_API_IMAGE=fylkren-asvs-cookies-api:latest FYLKREN_E2E_WEB_IMAGE=fylkren-asvs-header-file-web:latest node tools/run-e2e-editions.mjs --asvs-cookie-only --no-build
FYLKREN_E2E_API_IMAGE=fylkren-asvs-cookies-api:latest FYLKREN_E2E_WEB_IMAGE=fylkren-asvs-header-file-web:latest node tools/run-identity-sso-lab.mjs --no-build
```

Bootstrap sign-in issues `__Host-Fylkren`; antiforgery initialization issues `__Host-Fylkren.Antiforgery`. Both have `Secure`, `HttpOnly`, `SameSite=Strict`, `Path=/` and no `Domain`. Neither fallback `Fylkren.Session` nor `Fylkren.Antiforgery` is present. A request without the forwarded HTTPS boundary returns an HTTPS redirect and no cookie.

Source inventory then found that the framework-owned OIDC correlation/nonce and SAML request-state cookies retained their standard names. This host/subdomain cookie-injection defense gap is recorded and closed as SV-084. Production HTTPS configuration now issues `__Host-Fylkren.Oidc.Correlation.*`, `__Host-Fylkren.Oidc.Nonce.*` and `__Host-Fylkren.Saml2.*`, all with `Secure`, `HttpOnly`, `Path=/`, no `Domain` and the required `SameSite=None` for external-provider callbacks. The complete trusted-TLS lab passed signed OIDC and SAML login plus forged state, nonce, audience, unsigned/tampered assertion, replay and bounded metadata negatives.

The first expanded lab attempt also exposed that the newly introduced six-per-minute integration-test partition interrupted the maintained bounded metadata sequence. Provider, directory and SMTP connection tests now have a separate 30-per-minute identity partition; export and remote federation operations retain the stricter six-per-minute limit, and the common 120-write limit still applies. The final lab passed without removing anti-automation controls.

The API image is `sha256:c79729d6d904a2dd7896de63cb94254bf91256a0fdb734d796c88ca4db1d48d7`; the gateway image remains `sha256:2806135f53e64aaa7c63bcf2ff2e75933bb963361a42243bff84e2b512ae38e7`. ASVS 3.3.1–3.3.4 are Passed. Safe hashes and results are recorded under `secureCookieCompletion` in the evidence manifest. Production is untouched.

## Browser security mechanism headers — 2026-10-04

Completes ASVS 3.4.1–3.4.6. Source review found that the cached static-file location defined its own `Cache-Control` header and therefore did not inherit nginx's server-level `add_header` values. A baseline run against the preceding gateway image reproduced the defect on the actual versioned JavaScript asset: HSTS was absent. This is SV-085.

The static-file location now repeats the canonical policy with `always`, including in the maintained federation gateway fixtures. The final scoped command was:

```sh
FYLKREN_E2E_API_IMAGE=fylkren-asvs-cookies-api:latest FYLKREN_E2E_WEB_IMAGE=fylkren-asvs-browser-headers-web:latest node tools/run-e2e-editions.mjs --asvs-browser-headers-only --no-build
```

The current-image run passed document and static successes, a static 404, public API, unauthorized API, unknown API, health, mutation and authenticated API responses. Every class has at least one-year HSTS with `includeSubDomains`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, and CSP with the required self allowlist, `object-src 'none'`, `base-uri 'none'`, `frame-ancestors 'none'` and `form-action 'self'`. A hostile-origin simple request and preflight receive no `Access-Control-Allow-Origin`; Fylkren remains same-origin. The result is `{"browserSecurityHeaders":"passed","responseClasses":9,"hstsMinimumSeconds":31536000,"includeSubDomains":true,"cspRequiredDirectives":true,"nosniff":true,"noReferrer":true,"staticSuccessAndError":true,"hostileCorsDenied":true}`.

The API image is `sha256:c79729d6d904a2dd7896de63cb94254bf91256a0fdb734d796c88ca4db1d48d7`; the corrected gateway image is `sha256:9097512eb914b6acc30c143d929b37ce195552601e4ca3d9df4df4e16082e3d6`. SV-085 is closed. Safe hashes and results are recorded under `browserSecurityHeadersCompletion` in the evidence manifest. This does not complete CSRF/safe-method verification under 3.5.1/3.5.3 or production TLS termination qualification. Production is untouched.

## CSRF and safe HTTP method boundary — 2026-10-04

Completes ASVS 3.5.1 and 3.5.3. The route inventory records 103 GET, 112 POST, 45 PUT, zero PATCH and 25 DELETE declarations. Reviewed GET handlers are reads, downloads or external-login challenges. State-changing browser routes use mutation methods and pass through the common `BrowserAntiforgeryMiddleware` before authorization and endpoint dispatch. It requires the bound antiforgery cookie and `X-Fylkren-CSRF` header for every cookie-authenticated non-machine POST, PUT, PATCH and DELETE under `/api`. Signed anonymous federation receivers and bearer-authenticated machine endpoints do not use ambient browser-cookie authority.

The scoped current-image command was:

```sh
FYLKREN_E2E_API_IMAGE=fylkren-asvs-cookies-api:latest FYLKREN_E2E_WEB_IMAGE=fylkren-asvs-browser-headers-web:latest node tools/run-e2e-editions.mjs --asvs-csrf-only --no-build
```

Actual Site creation, profile update and profile-image deletion requests without tokens return bounded 400 responses before mutation. A hostile-origin profile update and an invalid token also return 400. A correctly bound cookie/header pair permits the valid profile update. GET, HEAD and OPTIONS against the password-mutation route each return 405, and the safe-method probes add no audit records. The test locks the source route counts so a later method addition requires review. Result: `{"csrfMethodBoundary":"passed","routeCounts":{"GET":103,"POST":112,"PUT":45,"PATCH":0,"DELETE":25},"missingTokenRejections":3,"hostileOriginRejected":true,"invalidTokenRejected":true,"validTokenAccepted":true,"safeMethodStatuses":{"GET":405,"HEAD":405,"OPTIONS":405},"safeMethodsCreatedAuditEvents":false}`.

No product correction was required. The reused API image is `sha256:c79729d6d904a2dd7896de63cb94254bf91256a0fdb734d796c88ca4db1d48d7`; the reused gateway image is `sha256:9097512eb914b6acc30c143d929b37ce195552601e4ca3d9df4df4e16082e3d6`. Safe hashes and results are recorded under `csrfMethodBoundaryCompletion` in the evidence manifest. Production is untouched.

## Browser technology and automatic redirect boundaries — 2026-10-04

Completes ASVS 3.7.1 and 3.7.2. The maintained source inventory covers 498 production TypeScript, TSX, CSS and HTML files. The client targets ES2022 and has four explicit runtime dependency families: the workspace UI, React, React DOM and QR-code canvas generation. It found no applet, plug-in, ActiveX, Flash, Shockwave, Silverlight or NaCl sink. It also locks the automatic navigation inventory to one same-origin client path, the OIDC and SAML server challenges and one same-origin administration `Location` header.

Review of the provider boundary found SV-086: valid metadata could select an OIDC authorization endpoint or SAML sign-in endpoint on a different, unapproved origin. The final OIDC response `Location` is now checked when headers start; rejection returns 502 with no redirect or transient SSO cookies. SAML metadata is rejected before caching when its sign-in destination is outside the metadata origin and the deployment-owned additional identity-origin allowlist. User-clicked document and licence links remain ordinary explicit navigation and are not automatic redirects.

Scoped commands:

```sh
node tools/test-browser-technology-redirects.mjs
dotnet run --project tests/foundations/Fylkren.FoundationTests.csproj --no-build -- --outbound-http-only
FYLKREN_E2E_API_IMAGE=fylkren-asvs-redirects-api:latest FYLKREN_E2E_WEB_IMAGE=fylkren-asvs-browser-headers-web:latest node tools/run-identity-sso-lab.mjs --no-build
```

The inventory reported `{"supportedBrowserTechnology":"passed","javascriptTarget":"ES2022","runtimeDependencies":4,"productionClientFiles":498,"legacyPluginSinks":0,"automaticClientNavigationSinks":1,"automaticExternalProviderFamilies":["oidc","saml"],"externalDestinationPolicy":"exact configured origin or deployment allowlist"}`. Foundation outbound/SAML cache tests passed. The trusted-TLS laboratory rejected foreign OIDC authorization and SAML sign-in origins while preserving the complete signed OIDC/SAML positive flows and all maintained state, issuer, nonce, audience, signature, replay, XML and metadata-boundary negatives.

The API image is `sha256:0b1413bba64b6ec65b9ee077668bea1a04ad1a706e2442bf14be188e6392369b`; the reused gateway image is `sha256:9097512eb914b6acc30c143d929b37ce195552601e4ca3d9df4df4e16082e3d6`. SV-086 is closed. Safe hashes and results are recorded under `browserTechnologyRedirectCompletion` in the evidence manifest. Production is untouched.
