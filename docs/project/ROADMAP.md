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

Internationalization starts after repository and security gates are stable. Move all user-visible text from source code into language resources and provide complete Norwegian Bokmål and English catalogs.

Requirements include:

- stable, language-neutral routes, permalinks, API contracts, database identifiers, and audit event types;
- locale-aware dates, times, numbers, plural forms, sorting, and search behavior;
- configured default language and timezone with documented fallback;
- translated navigation, validation, help, templates, email notifications, reports, print/PDF, bootstrap, and authentication;
- accessibility labels and error messages included in translation coverage;
- automated checks for missing and unused keys and layout regression with longer English text;
- no translation of tenant/site names, user content, historical snapshots, or managed classification definitions.

Existing `nb-NO` behavior must remain compatible during migration.

## Community and Enterprise release gate

The [edition architecture](../architecture/EDITION_ENTITLEMENTS.md) is part of the 1.0 production design, not a post-release product split. Before final system testing, complete private issuer key management, review software-license compatibility and prior history, and validate server-side entitlement enforcement, UI state, offline activation, expiry and customer-data access using the same API/web images and schema that will ship.

## Enterprise instance federation before final 1.0 testing

The [instance-federation implementation](../architecture/INSTANCE_FEDERATION.md) covers stable installation identity, protected signing keys, bilateral proof, automatic top-level catalogs, default-off audited GUI activation, ordinary request routing, signed delivery/returns, retry/idempotency, site moves, key rotation and controlled key-loss recovery. A two-database `Production` baseline proves disabled-state isolation, activation through the Platform Manager API, ordinary signed delivery without site-pair grants and absence of synthetic routes. Compatibility, browser, classified PDF, proxy/load, retention/load and matched database/key-ring restore evidence also exists. The [reviewer handoff](../security/FEDERATION_SECURITY_REVIEW_BRIEF.md) remains an independent release-governance gate; repeat all baselines against each release candidate and exercise restore with production backup custody before organizational activation.

## Documentation obligations

Every delivered capability must update the canonical material under `docs/` in the same change. Documentation must cover purpose, roles, configuration, normal use, failure behavior, security boundaries, APIs where applicable, backup/upgrade impact, and verification.

The managed documentation portal is [`docs/README.md`](../README.md). Do not create competing root-level manuals or copy implementation diaries into the roadmap.
