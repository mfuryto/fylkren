# Roadmap

Updated 2026-10-05 after completing requirement-level assessment of all 253 ASVS 5.0.0 Level 1/2 rows and defining the remaining identity-provider provisioning capability. Open findings, identity provisioning and final release-candidate qualification remain explicit.

This roadmap contains remaining work and release gates. Delivered behavior belongs in the manuals and architecture documents; completed changes belong in [CHANGELOG.md](../../CHANGELOG.md). Requirement and test status remain in their canonical documents, not in a second checklist here.

## Current baseline

Repository/documentation consolidation, the common Community/Enterprise entitlement implementation, internationalization, human-readable work references and operational federation are implemented. Maintained end-to-end and identity laboratories have executed successfully within their documented scopes. These are no longer future implementation milestones; candidate-specific reruns and deployment qualification remain release work.

The additive event/activity foundation and coherent WorkItem slice are delivered, including shared notification/webhook integration, authorized object/Site timelines and guarded closure, archive and restoration. Work-owned decisions, risks, measures, comments, learning and remaining planning/follow-up edits now use this same activity path, with exact-level learning privacy. Site/global-user archive custody, preservation controls, consistent exports and compatibility consumer reconciliation are also delivered and verified. WorkItem locking/archive now follow final operational decisions and resolved delivery, with explicit editing pauses, independent learning treatment and an Archived task view. Pending navigation counts now use a verified database aggregate; same-fixture role/hierarchy tests and before/after query plans are recorded in the [navigation continuation](../testing/runs/2026-10-02-release-regression.md#navigation-count-query-performance--2026-10-04). Permanent deletion, anonymisation and retention-policy execution remain disabled. See the [architecture and requirement/test traceability](../architecture/EVENT_ACTIVITY_AND_INFORMATION_LIFECYCLE.md) and [staged execution evidence](../testing/runs/2026-10-02-release-regression.md#work-owned-domain-activity-coverage--2026-10-03). Successful regression runs do not mean ASVS is complete.

## Next delivery order

1. Triage and remediate, or obtain explicit responsible-owner acceptance for, the 6 open finding records that affect 9 ASVS rows. Internal service transport, dependency vulnerabilities, the release-candidate SBOM, federated reauthentication, user session-management, mandatory-MFA and minimum cryptographic-strength gaps are closed. Prioritize service identity/secrets custody, native-transport destination enforcement, crypto agility, clock synchronization and separate log collection. Retest each affected row against the exact candidate when its control changes.
2. Deliver configurable identity-provider provisioning and the restricted unassigned-user state described below. Preserve the current explicit-link path and direct AD/LDAP personnel lookup.
3. Qualify the final release candidate through the functional, integration, security and deployment gates below. Reuse maintained test harnesses and evidence records; include production-equivalent HTTP/proxy/load sizing, identity providers, authenticators, backup/key custody, time synchronization and remote logging at this gate.

No irreversible disposition is authorized by this order. Establish and verify its prerequisites before proposing activation; do not choose arbitrary retention periods.

## Identity-provider provisioning — required before release qualification

Platform Manager must be able to enable or disable automatic person creation for each external identity provider. When enabled, a successfully verified but previously unknown AD, LDAP, OIDC or SAML identity creates one internal person and one provider-namespaced external identity link. This is just-in-time provisioning, not automatic directory import. Direct search and addition of selected AD/LDAP users from Site Manager's Personnel page remains supported, as does the existing controlled link to an internal person.

Provider-owned identity and sign-in fields are read-only in Fylkren. This includes the stable external identifier and the provider's username, name and email attributes. Fylkren remains authoritative for Site membership, organizational placement, roles, permissions and local access state. Email, username or display-name similarity must never merge identities or grant access.

A newly provisioned external person without local access assignments authenticates into a restricted information page explaining that Site, role and permissions have not yet been assigned. The person cannot access operational, Site or administrative data. The global user directory exposes these pending people to an authorized Platform Manager, who can assign a Site; the receiving Site Manager can then assign organizational placement, roles and permissions through the ordinary controls.

Implementation must be race-safe and auditable and must preserve namespaced immutable provider identifiers. Tests must cover provisioning disabled, one-time creation when enabled, concurrent first sign-ins, issuer/entity collisions, immutable provider-owned fields, the restricted pending session, denial of all unrelated APIs, assignment followed by ordinary access and suspension/unlink behavior. Current explicit-link and AD/LDAP direct-add behavior must remain compatible.

## Deferred irreversible lifecycle capabilities

The reversible event/activity and lifecycle foundation described in the [single architecture/requirements/test reference](../architecture/EVENT_ACTIVITY_AND_INFORMATION_LIFECYCLE.md) is delivered and verified. The following capabilities are explicitly deferred and are not missing behavior from that delivery:

- chunked large exports and applying restoration/import packages;
- purge-plan binding and explicit disposition authorization;
- replay-horizon preservation and resumable redaction/purge recovery;
- protection against deleted or anonymised data reappearing from backups.

Permanent deletion, anonymisation and retention-policy execution remain disabled until these prerequisites are designed, authorized and verified. Future work must retain the delivered common activity store and consumer projection ledger; it must not introduce a second event store, replacement security audit, broker or event sourcing.

## Navigation counters — delivered; production sizing remains

Pending-treatment counters exist on Tasks, Planning, Execution and Learning and refresh on work changes, focus and navigation. They count work awaiting treatment, not unread items. The optimization replaces full task-card materialization with a PostgreSQL COUNT and retains the existing Site/level authorization, dependency/descendant gates, outgoing local/federated request progress and planning/execution/learning semantics. No new cache, counter store, frontend polling scheme or schema migration is introduced.

The maintained 1,000 registered-task load plus 180 hierarchy cases and six cross-site counterparts passed old/new differential checks across three Sites/27 organizational units. Same-fixture database-read p95 in two interleaved rounds fell from 403–414 to 16–17 ms at concurrency 1, 699–702 to 24–25 ms at 10, and 1,417–1,429 to 51–52 ms at 25. Exact counts remained Tasks 1,075, Planning 3, Execution 5 and Learning 28. The [existing release record](../testing/runs/2026-10-02-release-regression.md#navigation-count-query-performance--2026-10-04) holds commands, plans, scope and source/log hashes.

Earlier HTTP p95 readings varied from subsecond values to multiple seconds and were not controlled before/after comparisons. The new plans identify unnecessary full-card projection/sort and JIT cost in this fixture: the larger Site query returns 1,040 card rows at estimated cost 340,168, with about 262 ms JIT time; the aggregate returns one row at cost 5,784 without JIT. This demonstrates a source of cardinality/plan sensitivity, not the cause of every earlier reading. The counter feature and local performance work are complete and committed to `main`. Production HTTP/proxy behavior and larger customer deployments remain release/deployment sizing under final release-candidate qualification.

## Security verification

The [ASVS 5.0 Level 2 matrix](../security/ASVS_5.0.0_L2_MATRIX.md) is the single security-testing work list and status authority. At this update all 253 rows are assessed: 190 Passed, 54 Not applicable and 9 rows with Findings, represented by 6 open records in the finding register. There are no `In progress` or `Not assessed` rows. Complete assessment means every requirement has a supported disposition; it is not a security certification or acceptance of open risk.

Use the [security test plan](../security/SECURITY_TEST_PLAN.md) and [threat model](../security/SECURITY_THREAT_MODEL.md). Record findings and remediation in the [finding register](../security/SECURITY_VERIFICATION.md); record completed requirement-specific tests in the ASVS matrix with links to maintained execution evidence. Partial coverage remains partial. Retest affected controls after every change.

HTTP destination/DNS/redirect/download boundaries and bounded runtime SAML metadata are delivered and tested. Current public and internal TLS/proxy qualification passes, the Alpine API candidate has zero current Trivy vulnerability results, immutable image/source CycloneDX SBOM generation is part of the release gate, users can inspect and selectively revoke their active browser sessions, interactive access requires MFA by default, and external RSA keys require at least 3072 bits. The finding register retains every unmet criterion, including native AD/LDAP DNS rebinding/egress, crypto agility, machine service credentials, secret custody, host clock synchronization and separate log collection. Do not rerun unrelated full-product chains for scoped corrections. Deployment-sensitive controls require customer identity-provider behavior, authenticator compatibility, host SSH/backup transport, coordinated database/Data Protection key recovery, production time synchronization and remote log custody. Disposable restore tests already exist; operational custody qualification remains separate.

The host-status integration now exposes NTP synchronization and a 1,000 ms offset boundary. SV-107 stays open until the deployment owner installs it and records production-equivalent synchronized status, alert handling and cross-system timestamp correlation.

Mandatory MFA remains the secure default. Optional or disabled MFA is a supported customer-owned exception with explicit risk documentation and a persistent reduced-security signal in Platform Manager; an excepted deployment must qualify its own compensating controls and cannot silently inherit the default ASVS 6.3.3 result.

Relevant Level 3 controls, WSTG techniques and API Security Top 10 coverage support this same workflow. An external penetration test is optional if requested, not a prerequisite for completing the authorized testing.

## Final release-candidate qualification

Run the maintained [end-to-end acceptance suite](../testing/END_TO_END_TEST_MATRIX.md) from reset synthetic fixtures against the exact API/web images and schema intended for release, in both Community and Enterprise states. Cover operational workflows, hierarchy/routing, notifications, learning privacy, authorization, machine APIs, activity/archive behavior and workload sizing. Repeat the affected complete chain after corrections; do not treat historical runs as evidence for untested candidate changes.

Repeat the maintained AD/LDAP, OIDC/SAML, SMTP and federation laboratories for affected integrations. Historical mixed-version federation needs an archived release artifact; current Production-boundary tests do not prove that compatibility. Qualify matched database/key-ring recovery and fencing before organizational federation activation. See [instance federation](../architecture/INSTANCE_FEDERATION.md).

Qualify production issuer/private-key custody and offline key management separately from the synthetic edition fixtures. Preserve one common API/web build and customer-data access across entitlement transitions. See [edition architecture](../architecture/EDITION_ENTITLEMENTS.md).

Resolve or explicitly accept documented residual security findings. Do not describe the product as security-qualified until the required verification and deployment gates are complete.

## Publication and distribution

Before public distribution, obtain legal/commercial approval of the source license, customer terms, entitlement policy, copyright ownership and earlier license history. See [licensing](LICENSING.md). Repeat repository and reachable-history scans for secrets, personal/customer data, workstation artifacts, generated content and dependency/license obligations against the publication candidate; earlier passing scans do not replace this final gate.

Versioned air-gapped package signing and verification remain future distribution work. Existing image/source transfer and backup procedures must not be described as signed-package support.

## Maintenance obligations

Update canonical manuals, architecture, upgrade/recovery notes and requirement/test traceability with each delivered capability. Keep repository material English and UI text in maintained locale catalogs. Preserve automated localization checks and assess affected translated layouts when adding UI behavior; do not reopen completed internationalization as a new migration project.

Use the [documentation portal](../README.md), [installation and upgrade procedure](../operations/INSTALLATION_AND_UPGRADES.md), existing test harnesses and the single ASVS matrix. Do not create parallel manuals, security matrices or implementation diaries in this roadmap.
