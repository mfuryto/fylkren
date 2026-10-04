# Roadmap

Updated 2026-10-04 after automatic WorkItem locking/archive and the targeted execution-activity clarity correction.

This roadmap contains remaining work and release gates. Delivered behavior belongs in the manuals and architecture documents; completed changes belong in [CHANGELOG.md](../../CHANGELOG.md). Requirement and test status remain in their canonical documents, not in a second checklist here.

## Current baseline

Repository/documentation consolidation, the common Community/Enterprise entitlement implementation, internationalization, human-readable work references and operational federation are implemented. Maintained end-to-end and identity laboratories have executed successfully within their documented scopes. These are no longer future implementation milestones; candidate-specific reruns and deployment qualification remain release work.

The additive event/activity foundation and coherent WorkItem slice are delivered, including shared notification/webhook integration, authorized object/Site timelines and guarded closure, archive and restoration. Work-owned decisions, risks, measures, comments, learning and remaining planning/follow-up edits now use this same activity path, with exact-level learning privacy. Site/global-user archive custody, preservation controls, consistent exports and compatibility consumer reconciliation are also delivered and verified. WorkItem locking/archive now follow final operational decisions and resolved delivery, with explicit editing pauses, independent learning treatment and an Archived task view. Permanent deletion, anonymisation and retention-policy execution remain disabled. See the [architecture and requirement/test traceability](../architecture/EVENT_ACTIVITY_AND_INFORMATION_LIFECYCLE.md) and [staged execution evidence](../testing/runs/2026-10-02-release-regression.md#work-owned-domain-activity-coverage--2026-10-03). Successful regression runs do not mean ASVS is complete.

## Next delivery order

1. Correct and qualify navigation-count performance with the maintained hierarchy/load fixture. This is a separate sizing concern, not a reason to change pending-count semantics or authorization.
2. Retest security requirements affected by these changes in the existing ASVS matrix, then resume incomplete chapter-1 requirements 1.3.3, 1.3.6 and 1.4.2. Continue the remaining matrix in the established requirement-order workflow.
3. Qualify the final release candidate through the functional, integration, security and deployment gates below. Reuse maintained test harnesses and evidence records.

No irreversible disposition is authorized by this order. Establish and verify its prerequisites before proposing activation; do not choose arbitrary retention periods.

## Remaining event/activity and lifecycle coverage

Use the [single architecture/requirements/test reference](../architecture/EVENT_ACTIVITY_AND_INFORMATION_LIFECYCLE.md) for detailed scope and T01–T14 acceptance cases.

- The authorized reversible foundation is implemented: Work-owned domain activity, Site/global-user archives/custody, consistent exports, preservation administration and common consumer cutover. Final candidate foundation, API/recovery, Chromium and affected identity/federation chains passed in the [existing release record](../testing/runs/2026-10-02-release-regression.md#consumer-reconciliation-and-final-reversible-foundation--2026-10-03); do not infer full product/security qualification from foundation delivery.
- Snapshot portability, lifecycle/federation evidence and explicit export custody are delivered within the documented package limits. Chunked large exports and restoration/import apply remain future capabilities.
- Configurable immutable policy metadata, independent holds, snapshot exports, verified custody and cross-owner archive protection are delivered. Before irreversible disposition, extend these into purge-plan binding, disposition authorization, replay-horizon preservation and resumable redaction/purge recovery, including backup resurrection protection.
- Legacy notification obligations are reconciled once at startup; SMTP no longer scans audit, and webhook workers consume the common projection ledger. Retained old cursor/marker fields are compatibility evidence. Never introduce a second activity store, replacement security audit, broker or event sourcing.

## Navigation-count performance

Pending-treatment counters already exist on Tasks, Planning, Execution and Learning and refresh on work changes, focus and navigation. This next delivery improves and qualifies their query performance; it does not add a second counter mechanism or change them to unread counts. The execution-activity correction is complete and does not claim to resolve this sizing issue.

Multi-second `/api/work/navigation-counts` reads were observed under 10/25 concurrent readers against both the additive checkpoint and the WorkItem candidate. The fixtures differ, so this is not a controlled performance-equivalence result. The maintained workload harness records per-endpoint measurements; the [staged run](../testing/runs/2026-10-02-release-regression.md#work-owned-domain-activity-coverage--2026-10-03) contains the evidence.

The governance continuation reproduced navigation-count p95 of 3,200/5,869/9,163 ms at concurrency 1/10/25. Subsequent unchanged-query preservation and final consumer runs measured 91/136/301 ms and 96/138/253 ms respectively. Explain this variation with repeatable query plans and fixture/runtime conditions; do not infer a fix from faster runs.

Reproduce query plans, correct the bottleneck and qualify the result against the full hierarchy fixture before production sizing approval. Preserve role/level predicates, Site isolation and counts of elements waiting for treatment. Do not hide the problem by simplifying fixtures or broadening visibility.

## Security verification

The [ASVS 5.0 Level 2 matrix](../security/ASVS_5.0.0_L2_MATRIX.md) is the single security-testing work list and status authority. At this update it contains 35 Passed, 112 In progress, 53 Not assessed and 53 Not applicable requirements. Counts are a dated baseline, not a separate maintained matrix or security certification.

Use the [security test plan](../security/SECURITY_TEST_PLAN.md) and [threat model](../security/SECURITY_THREAT_MODEL.md). Record findings and remediation in the [finding register](../security/SECURITY_VERIFICATION.md); record completed requirement-specific tests in the ASVS matrix with links to maintained execution evidence. Partial coverage remains partial. Retest affected controls after every change.

Complete remaining integration/interpreter boundaries, outbound destination/DNS/redirect/size checks and derived/aggregate arithmetic first, then continue the matrix. Deployment-sensitive controls require production-equivalent TLS, canonical Host/port and proxy configuration, customer identity-provider behavior, authenticator compatibility and coordinated database/Data Protection key recovery with real backup custody. Disposable restore tests already exist; operational custody qualification remains separate.

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
