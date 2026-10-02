# Roadmap

This roadmap contains approved future work and release gates. Current behavior belongs in the maintained manuals and architecture documents. Completed changes belong in `CHANGELOG.md`; they are not repeated here.

## Delivery order

1. Complete repository and documentation consolidation.
2. Complete the [one-product Community/Enterprise entitlement foundation](../architecture/EDITION_ENTITLEMENTS.md), including the private production issuer and offline key-management procedure. API and web remain separate containers/images, but never have edition-specific builds.
3. Run the clean end-to-end acceptance suite from reset synthetic fixtures in both edition states.
4. Complete the documented ASVS security verification against the same edition architecture.
5. Internationalize the product and make repository content consistently English.

Each gate must be complete and evidenced before the next gate changes public contracts or distribution.

## Event/activity and information lifecycle foundations

The [source review and proposed architecture](../architecture/EVENT_ACTIVITY_AND_INFORMATION_LIFECYCLE.md) is the single design/requirement/test reference for this work. The additive foundation and coherent WorkItem slice are implemented; their staged execution evidence and remaining coverage are recorded in that document. This foundation work precedes the next security-testing continuation at the user's request. Existing external contracts remain unchanged.

Implement additively on the existing domain-event model, preserving authoritative state/revisions and independent security audit. The delivered WorkItem/plan/report slice establishes notification/webhook cutover using existing queues, authorized object/site timelines and guarded closed/archive state. Next extend risk/measure/decision and other activity coverage, site/user custodianship, snapshot portability and relationship-aware lifecycle adapters. Do not introduce a broker, duplicate activity writer, second audit stream or automatic purge/retention periods.

Before enabling irreversible disposition, implement independent policy/hold gates, export-before-deletion, cross-owner reference protection, replay-horizon preservation and resumable redaction/purge recovery. Architecture requirement IDs and T01–T14 acceptance cases are maintained in the linked proposal, rather than duplicated here. Retest affected controls in the existing ASVS matrix after implementation; then resume incomplete chapter-1 requirements 1.3.3, 1.3.6 and 1.4.2 in the established workflow.

## Navigation-count sizing follow-up

The staged foundation verification reproduced multi-second `/api/work/navigation-counts` reads under 10/25 concurrent readers against both the additive checkpoint and the WorkItem candidate. The maintained workload harness now records per-endpoint measurements so this existing bottleneck can be isolated. Preserve role/level predicates and pending-count semantics when correcting it; do not hide it by changing the fixture or broadening visibility. Other measured reads remain separate. Reproduce query plans and qualify the correction against the full hierarchy fixture before production sizing approval. See the [existing staged run](../testing/runs/2026-10-02-release-regression.md#activity-and-lifecycle-delivery--2026-10-03).

## Repository readiness

Prepare the repository for possible public publication. Retain only material required to build, test, operate, understand, and maintain the product. Remove obsolete proposals, duplicate specifications, temporary work notes, workstation artifacts, generated content that can be reproduced, and synthetic data that is not a maintained fixture.

Every tracked file must have a clear purpose. No credential, customer data, local password, private test evidence, environment-specific secret, or workstation path may exist in publishable content or reachable history.

All repository-facing material must be English: source identifiers and comments, documentation, examples, tests, scripts, configuration comments, and issue/PR templates. The UI is separate: Norwegian Bokmal remains the existing `nb-NO` product language.

Before publication, run repository and history scans for secrets, personal data, large binaries, local paths, generated artifacts, and license obligations. Document the reproducible checks in the operations manual.

## Clean end-to-end release run

Execute the complete [end-to-end acceptance matrix](../testing/END_TO_END_TEST_MATRIX.md) against one release candidate from reset synthetic fixtures. The run must cover task, planning, execution, reporting, internal delegation, requests, parent/child sites, recursive hierarchy, moves, cancellation, reassignment, notifications, workload, authorization, and public machine APIs.

No scenario passes with data loss, duplicate instances, incorrect routing, unauthorized visibility, stale counts, missing reports, or unexplained notification failure. Retest the complete affected chain after each correction.

## Closed identity and messaging laboratory

Before external identity and messaging integrations are production-qualified, test them in a closed environment. Existing directories used for unrelated purposes must not be modified; use isolated instances, tenants, organizational units, accounts, and certificates.

### AD and LDAP

Test Samba Active Directory Domain Controller and OpenLDAP/slapd, including:

- LDAPS and StartTLS with internal-CA trust and invalid-certificate rejection;
- a least-privileged lookup account;
- bounded search by name, email, and username without automatic Personnel population;
- explicit site and unit addition, roles, and multi-site membership;
- stable `objectGUID` and `entryUUID` links;
- sign-in, managed name/email synchronization, and local-password prohibition;
- disabled, deleted, moved, and renamed directory users;
- unavailable directory, invalid bind account, filter injection, special characters, and oversized result sets;
- audit and technical logs free of user passwords and bind secrets.

### OIDC and SAML

Verify issuer/entity identity, metadata and signing trust, callback paths, claims/NameID mapping, account linking, disabled identities, logout behavior, provider failure, and safe local Platform Manager recovery.

### SMTP notifications

Verify connection modes, sender identity with site context, template fields, recipient rules, queueing, duplicate prevention, personal muting, retries, visible failure cause, audit, and successful delivery for every configured event category.

## Mandatory security verification

Security verification is a release requirement, not an optional enhancement. Fylkren must not be described as production-ready for security-sensitive use until the verification is complete, findings are remediated or explicitly accepted, and results are documented.

The baseline is:

- OWASP ASVS 5.0 Level 2;
- relevant Level 3 requirements for security-critical identity, authorization, audit, cryptography, and integrations;
- OWASP Web Security Testing Guide for dynamic testing;
- OWASP API Security Top 10 for all machine and browser APIs.

Use the [security test plan](../security/SECURITY_TEST_PLAN.md), [threat model](../security/SECURITY_THREAT_MODEL.md), [verification record](../security/SECURITY_VERIFICATION.md), and [ASVS matrix](../security/ASVS_5.0.0_L2_MATRIX.md). Use the ASVS matrix as the single security-testing work list and complete the coordinated database/Data Protection key restore exercise. An external penetration test is optional when requested.

## Internationalization

Internationalization is an active pre-release gate. Move all user-visible text from source code into language resources. American English (`en-US`) is the complete source catalog and mandatory fallback; British English (`en-GB`) is a distinct complete regional variant, and Norwegian Bokmal is a separate complete catalog.

Requirements include:

- stable, language-neutral routes, permalinks, API contracts, database identifiers, and audit event types;
- locale-aware dates, times, numbers, plural forms, sorting, and search behavior;
- database-backed language, IANA time zone, clock-format and measurement-system defaults managed by Platform Manager, with documented English fallback;
- translated navigation, validation, help, templates, email notifications, reports, print/PDF, bootstrap, and authentication;
- accessibility labels and error messages included in translation coverage;
- automated checks for missing and unused keys, repository-language violations and layout regression with longer localized text;
- no translation of tenant/site names, user content, historical snapshots, or managed classification definitions.

Existing `nb-NO` behavior must remain compatible during migration. Norwegian text is permitted only inside the dedicated `nb-NO` language resources; source, comments, tests, examples and documentation remain English.

The English migration and full repository-language check are complete. Complete packs are bundled for Swedish (`sv-SE`), Danish (`da-DK`), Finnish (`fi-FI`), German (`de-DE`), French (`fr-FR`), Polish (`pl-PL`), Spanish (`es-ES`), Italian (`it-IT`), Ukrainian (`uk-UA`), Dutch (`nl-NL`), Portuguese (`pt-PT`), Czech (`cs-CZ`), Romanian (`ro-RO`), Estonian (`et-EE`), Latvian (`lv-LV`) and Lithuanian (`lt-LT`). They are governed by the automated linguistic and technical acceptance process in the localization policy rather than a requirement to recruit a reviewer for every language. Icelandic was removed from the approved roster.

## Human-readable work references

Implemented after the internationalization gate. Root work uses a customer-managed task type abbreviation or Site fallback code plus one installation-wide forward-only number, such as `OPS-000123`. Delegated work and requests extend the parent reference with sibling numbers, such as `OPS-000123-1` and `OPS-000123-1-1`. Allocation is transactional and concurrency-safe; references are immutable, searchable and carried through planning, execution, reports and formal approval history. Platform Manager and Site Manager configuration is available under the single **References** menu. Site Managers maintain manual source and sender registries separately under **Intake**; externally received values remain snapshots.

Federated work retains the signed origin reference and receives a separate local reference. The stable origin identity tuple remains the protocol identity and idempotency key; a display reference is never treated as a global authorization boundary.

## Community and Enterprise release gate

The [edition architecture](../architecture/EDITION_ENTITLEMENTS.md) is part of the 1.0 production design, not a post-release product split. Before final system testing, complete private issuer key management, review software-license compatibility and prior history, and validate server-side entitlement enforcement, UI state, offline activation, expiry and customer-data access using the same API/web images and schema that will ship.

## Enterprise instance federation before final 1.0 testing

The [instance-federation implementation](../architecture/INSTANCE_FEDERATION.md) covers stable installation identity, protected signing keys, bilateral proof, automatic top-level catalogs, default-off audited GUI activation, ordinary request routing, signed delivery/returns, retry/idempotency, site moves, key rotation and controlled key-loss recovery. A two-database `Production` baseline proves disabled-state isolation, activation through the Platform Manager API, ordinary signed delivery without site-pair grants and absence of synthetic routes. Compatibility, browser, classified PDF, proxy/load, retention/load and matched database/key-ring restore evidence also exists. The [reviewer handoff](../security/FEDERATION_SECURITY_REVIEW_BRIEF.md) is an optional external-review template; repeat all baselines against each release candidate and exercise restore with production backup custody before organizational activation.

## Documentation obligations

Every delivered capability must update the canonical material under `docs/` in the same change. Documentation must cover purpose, roles, configuration, normal use, failure behavior, security boundaries, APIs where applicable, backup/upgrade impact, and verification.

The managed documentation portal is [`docs/README.md`](../README.md). Do not create competing root-level manuals or copy implementation diaries into the roadmap.
