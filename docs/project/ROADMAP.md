# Roadmap

This roadmap contains approved future work and release gates. Current behavior belongs in the maintained manuals and architecture documents. Completed changes belong in `CHANGELOG.md`; they are not repeated here.

## Delivery order

1. Complete repository and documentation consolidation.
2. Complete the [one-product Community/Enterprise entitlement foundation](../architecture/EDITION_ENTITLEMENTS.md), including the private production issuer and offline key-management procedure. API and web remain separate containers/images, but never have edition-specific builds.
3. Run the clean end-to-end acceptance suite from reset synthetic fixtures in both edition states.
4. Complete the documented security verification and independent review against the same edition architecture.
5. Internationalize the product and make repository content consistently English.

Each gate must be complete and evidenced before the next gate changes public contracts or distribution.

## Repository readiness

Prepare the repository for possible public publication. Retain only material required to build, test, operate, understand, and maintain the product. Remove obsolete proposals, duplicate specifications, temporary work notes, workstation artifacts, generated content that can be reproduced, and synthetic data that is not a maintained fixture.

Every tracked file must have a clear purpose. No credential, customer data, local password, private test evidence, environment-specific secret, or workstation path may exist in publishable content or reachable history.

All repository-facing material must be English: source identifiers and comments, documentation, examples, tests, scripts, configuration comments, and issue/PR templates. The UI is separate: Norwegian Bokmål remains the existing `nb-NO` product language.

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

Use the [security test plan](../security/SECURITY_TEST_PLAN.md), [threat model](../security/SECURITY_THREAT_MODEL.md), [verification record](../security/SECURITY_VERIFICATION.md), and [ASVS matrix](../security/ASVS_5.0.0_L2_MATRIX.md). Complete the coordinated database/Data Protection key restore exercise and an independent penetration test.

## Internationalization

Internationalization is an active pre-release gate. Move all user-visible text from source code into language resources. English is the complete source catalog and mandatory fallback; Norwegian Bokmål is a separate complete catalog.

Requirements include:

- stable, language-neutral routes, permalinks, API contracts, database identifiers, and audit event types;
- locale-aware dates, times, numbers, plural forms, sorting, and search behavior;
- database-backed language, IANA time zone, clock-format and measurement-system defaults managed by Platform Manager, with documented English fallback;
- translated navigation, validation, help, templates, email notifications, reports, print/PDF, bootstrap, and authentication;
- accessibility labels and error messages included in translation coverage;
- automated checks for missing and unused keys, repository-language violations and layout regression with longer localized text;
- no translation of tenant/site names, user content, historical snapshots, or managed classification definitions.

Existing `nb-NO` behavior must remain compatible during migration. Norwegian text is permitted only inside the dedicated `nb-NO` language resources; source, comments, tests, examples and documentation remain English.

## Human-readable work references after internationalization

After the internationalization gate is complete, introduce a Jira-inspired human-readable reference for every work item, including parent work, delegated child work, requests and federated work. The database UUID remains the canonical internal identifier; the reference is a durable operator-facing identifier used in navigation, search, notifications, reports, exports, audit presentation and supported APIs.

Platform Manager must administer the installation-wide reference policy in the GUI. This includes allowed prefix syntax and length, reserved prefixes, namespace rules, sequence behavior and collision diagnostics. Site Manager must configure the permitted reference prefix and related presentation settings for each site in the GUI. Configuration changes and reference allocation are audited. Numbers are allocated transactionally, never reused, and remain stable when a site is renamed, moved, deactivated or restored. Changing a prefix must not silently rewrite historical references; retained aliases or an explicit migration policy must preserve existing links and searches.

The design must include:

- a readable form such as `OPS-1234`, without treating that text as the authorization or tenancy boundary;
- deterministic, concurrency-safe allocation and a documented migration for existing work items;
- exact and partial reference search, direct navigation and clear display throughout Tasks, Planning, Execution, Reports and approval history;
- validation and preview in Platform Manager and Site Manager before a policy is activated;
- backup, restore, portable export, API, webhook, notification and audit coverage;
- explicit behavior for child work, requests, cancellation, reassignment, site moves and prefix changes;
- accessibility and localization of surrounding labels while the reference itself remains language-neutral.

Federation must not assume that a display reference is globally unique. The stable origin tuple `(originInstanceId, originSiteId, originResourceId)` remains the cross-installation identity and idempotency key. Federated presentation must retain both the origin reference and the receiving installation's local reference when one is allocated. A compact instance/site namespace or qualified display form may be added for people, but collisions must be detected and shown rather than resolved by silently changing a remote reference. Mixed-version delivery, retries, site moves, peer replacement, restore and export/import must preserve provenance and both references.

Before implementation, record the final prefix, alias, sequence and federated presentation decisions in the architecture decision register and extend the end-to-end matrix with concurrency and collision scenarios.

## Community and Enterprise release gate

The [edition architecture](../architecture/EDITION_ENTITLEMENTS.md) is part of the 1.0 production design, not a post-release product split. Before final system testing, complete private issuer key management, review software-license compatibility and prior history, and validate server-side entitlement enforcement, UI state, offline activation, expiry and customer-data access using the same API/web images and schema that will ship.

## Enterprise instance federation before final 1.0 testing

The [instance-federation implementation](../architecture/INSTANCE_FEDERATION.md) covers stable installation identity, protected signing keys, bilateral proof, automatic top-level catalogs, default-off audited GUI activation, ordinary request routing, signed delivery/returns, retry/idempotency, site moves, key rotation and controlled key-loss recovery. A two-database `Production` baseline proves disabled-state isolation, activation through the Platform Manager API, ordinary signed delivery without site-pair grants and absence of synthetic routes. Compatibility, browser, classified PDF, proxy/load, retention/load and matched database/key-ring restore evidence also exists. The [reviewer handoff](../security/FEDERATION_SECURITY_REVIEW_BRIEF.md) remains an independent release-governance gate; repeat all baselines against each release candidate and exercise restore with production backup custody before organizational activation.

## Documentation obligations

Every delivered capability must update the canonical material under `docs/` in the same change. Documentation must cover purpose, roles, configuration, normal use, failure behavior, security boundaries, APIs where applicable, backup/upgrade impact, and verification.

The managed documentation portal is [`docs/README.md`](../README.md). Do not create competing root-level manuals or copy implementation diaries into the roadmap.
