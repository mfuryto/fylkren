# Fylkren documentation and manual

This is the canonical documentation index. Each subject should have one maintained source; obsolete working notes and parallel descriptions are removed rather than retained.

## Start here

- **End users and leaders:** [Complete user manual](administration/USER_MANUAL.md), followed by [tasks and operational flow](administration/WORKFLOW_AND_TASKS.md) and [risk and mitigation management](administration/RISK_MANAGEMENT.md).
- **Site Managers:** user manual, [access and identity](administration/ACCESS_AND_IDENTITY.md), [workflows and templates](administration/WORKFLOWS_AND_TEMPLATES.md) and [notifications](operations/NOTIFICATIONS.md).
- **Platform Managers and operators:** [installation and upgrades](operations/INSTALLATION_AND_UPGRADES.md), [Windows Server installation](operations/WINDOWS_SERVER_INSTALLATION.md), [server setup](operations/SERVER_SETUP.md), [federation administration](administration/FEDERATION.md), [deployment/offline operation](operations/DEPLOYMENT_AND_OFFLINE.md) and [security and retention](security/SECURITY_AND_RETENTION.md).
- **Integrators:** [API conventions](api/API.md), then the [Administration API](api/ADMINISTRATION_API.md) or [Report API](api/REPORT_API.md).
- **Developers and reviewers:** [technical architecture](architecture/TECHNICAL_ARCHITECTURE.md), [repository structure](architecture/REPOSITORY_STRUCTURE.md), test evidence, [security verification](security/SECURITY_VERIFICATION.md) and the [independent federation review brief](security/FEDERATION_SECURITY_REVIEW_BRIEF.md).

Before public publication, run `bash tools/security/verify-repository-safety.sh --history`. The gate checks current content and reachable history for tracked local/generated artifacts, large files, workstation paths and secrets.

## Product and architecture

- [Product principles](product/PRODUCT_PRINCIPLES.md)
- [Domain model](product/DOMAIN_MODEL.md)
- [Site model](product/SITE_MODEL.md)
- [Technical architecture](architecture/TECHNICAL_ARCHITECTURE.md)
- [Independent-instance federation foundation](architecture/INSTANCE_FEDERATION.md)
- [Community and Enterprise entitlements](architecture/EDITION_ENTITLEMENTS.md)
- [Platform license API](api/PLATFORM_LICENSE_API.md)
- [Versioning and formal approvals](architecture/FORMAL_APPROVALS.md)
- [User interface and white-label design](product/UI_AND_WHITE_LABEL.md)
- [Repository structure](architecture/REPOSITORY_STRUCTURE.md)

## Installation and operations

- [Installation and upgrades](operations/INSTALLATION_AND_UPGRADES.md)
- [Windows Server installation with Hyper-V](operations/WINDOWS_SERVER_INSTALLATION.md)
- [Host status integration](operations/HOST_STATUS.md)
- [Get and import an Enterprise license, including air-gapped installations](operations/GET_ENTERPRISE_LICENSE.md)
- [Deployment, backup and offline operation](operations/DEPLOYMENT_AND_OFFLINE.md)
- [Server setup](operations/SERVER_SETUP.md)
- [System requirements](operations/SYSTEM_REQUIREMENTS.md)
- [Performance verification](operations/PERFORMANCE_VERIFICATION.md)

## Administration and identity

- [Access and identity](administration/ACCESS_AND_IDENTITY.md)
- [Access matrix](administration/ACCESS_MATRIX.md)
- [Notifications](operations/NOTIFICATIONS.md)
- [Security and retention](security/SECURITY_AND_RETENTION.md)
- [User manual](administration/USER_MANUAL.md)
- [Federation administration](administration/FEDERATION.md)

## Work management

- [Tasks and operational flow](administration/WORKFLOW_AND_TASKS.md)
- [Workflows and templates](administration/WORKFLOWS_AND_TEMPLATES.md)
- [Risk and mitigation management](administration/RISK_MANAGEMENT.md)
- [Versioning and formal approvals](architecture/FORMAL_APPROVALS.md)
- [End-to-end test matrix](testing/END_TO_END_TEST_MATRIX.md)

## APIs and integrations

- [API conventions](api/API.md)
- [Administration API](api/ADMINISTRATION_API.md)
- [Report API](api/REPORT_API.md)
- [Portable export format and customer exit](api/PORTABLE_EXPORT_FORMAT.md)
- [Domain events and webhooks](api/WEBHOOKS.md)

## Security

- [Security policy](../SECURITY.md)
- [Security test plan](security/SECURITY_TEST_PLAN.md)
- [Threat model](security/SECURITY_THREAT_MODEL.md)
- [Independent-instance federation threat model](security/FEDERATION_THREAT_MODEL.md)
- [Security verification record](security/SECURITY_VERIFICATION.md)
- [OWASP ASVS 5.0 Level 2 matrix](security/ASVS_5.0.0_L2_MATRIX.md)
- [Offline password blocklist](security/PASSWORD_BLOCKLIST.md)
- [Secrets and security logging](security/SECRETS_AND_SECURITY_LOGGING.md)

## Project maintenance

- [Publication readiness and repository audit](project/PUBLICATION_READINESS.md)
- [GitHub repository security](operations/GITHUB_REPOSITORY_SECURITY.md)
- [Development stack](architecture/DEVELOPMENT_STACK.md)
- [Roadmap](project/ROADMAP.md)
- [Product and architecture decisions](project/DECISIONS.md)
- [Changelog](../CHANGELOG.md)
- [Licensing](project/LICENSING.md)
- [Copyright notice](../NOTICE.md) and [trademark guidance](../TRADEMARKS.md)
- [Third-party notices](project/THIRD_PARTY_NOTICES.md)

## Documentation rules

- Repository documentation, source comments, test descriptions and examples are written in English.
- UI localization is separate from repository language. Norwegian Bokmål remains `nb-NO`; English will be an additional complete locale.
- Routes, API contracts, persistent identifiers and permalinks remain language-neutral.
- Documentation must describe current behavior. Planned behavior belongs in the roadmap, and released changes belong in the changelog.
- Air-gapped operation must never depend on external documentation, fonts, scripts or runtime lookups.
- Every user-visible feature must update the relevant manual section in the same change.
- Examples must use synthetic names and data. Commands must distinguish first installation, routine upgrade and destructive development-only operations.
- API documents are versioned contracts. UI labels and screenshots are supporting material, not authorization or protocol definitions.
- Security and test records describe evidence and remaining verification; they must not claim completion without reproducible results.
