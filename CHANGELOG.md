# Changelog

This file records durable, user-visible release changes. Detailed implementation history remains available in Git and is not duplicated here.

## Unreleased

- Replaced the Platform status placeholders with a bounded host-status integration for disk capacity, complete-backup time, web/API/PostgreSQL health and restart counts. The root-owned collector writes a sanitized snapshot through a read-only API mount and never exposes the Docker socket to the application. Added one-command creation, automatic registration, immediate status refresh and conservative configurable local retention for complete PostgreSQL, configuration and Data Protection key backup sets under the Git-ignored installation backup directory.
- Added a guarded one-command disaster-recovery restore that validates completion markers, checksums, database format and key-archive paths before replacing the database, configuration and Data Protection volumes after explicit destructive confirmation.
- Added a complete Windows Server 2022/2025 installation guide using a dedicated Hyper-V Linux VM, including host preparation, VM creation, Docker installation, networking, TLS, persistence, backup, maintenance and acceptance checks. Clarified that Docker Desktop and native Windows containers are not supported deployment paths.
- Completed default-off Enterprise federation for ordinary cross-installation requests, signed progress/cancellation/official responses, automatic active top-level-site catalogs, GUI activation, delivery monitoring, planned key rotation and controlled lost-key recovery. No site-pair or directional permissions are required after bilateral peer approval and connection testing.
- Added a complete Platform Manager federation guide and reconciled the README, user, site, domain, architecture, operations, security and test documentation with the implemented behavior.
- Enforced the documented separation between Site Manager administration and operational queues, and expanded dynamic authorization tests for role, site, object and direct GUID-substitution boundaries.
- Prevented the Overview client from making predictable unauthorized descendant-workload requests for users without leader access, avoiding misleading `access-rejected` warnings while retaining server-side enforcement.

## 0.69.1 — 2026-09-24

- Reduced the anonymous configuration response to sign-in essentials. Version, edition, entitlements, site capacity and classification metadata now require an authenticated session.
- Kept remote browser login and first-run setup available; the public endpoint cannot be bound to loopback without breaking those flows.

## 0.69.0 — 2026-09-24

- Added the Enterprise-only federation administration foundation for exchanging instance identity and signing keys, registering peers, publishing top-level sites, synchronizing a signed site catalog and managing reciprocal site permissions.
- Verified the control plane between isolated Fylkren instances over HTTPS, including replay protection, revocation, catalog changes and preservation of existing data during a simulated schema upgrade.
- Federation does not yet send assignments, status updates or reports between installations. Remote sites are deliberately absent from operational recipient search until that transport and its authorization are implemented and tested.

## 0.68.1 — 2026-09-23

- Show the effective Community or Enterprise edition directly below the Fylkren version in the left navigation, updating from the server's current license status.

## 0.68.0 — 2026-09-23

- Prepared the single Community/Enterprise repository for source-available publication under the exact PolyForm Perimeter 1.0.0 license, with THUNOLD-OLSEN copyright notice and separate Fylkren trademark guidance.
- Reworked the README and documentation portal for the planned public release, including edition comparison, installation orientation, issue templates and a publication gate.
- Removed the license issuer from the current distributable tree. Edition regression tests use public, pre-signed synthetic fixtures in an isolated database instead of generating licenses from a private key.
- Sanitized example deployment and security-check defaults. Existing Git history and release/legal review remain explicit blockers before changing repository visibility.

## 0.67.0 — 2026-09-23

- Established Community and Enterprise on the same application and schema, with a centrally defined entitlement catalogue and server-side API enforcement.
- Added offline, instance-bound signed license import and status for Platform Manager. Community runs without a license or Internet access; license expiry and removal preserve customer data.
- Assigned new AD/LDAP, OIDC and SAML links/import, machine APIs and webhooks to Enterprise while keeping existing linked users able to authenticate after entitlement loss. Local identity, MFA and passkeys remain Community.
- Added an isolated edition-transition E2E harness and operational documentation. A local issuer tool was included in this historical revision and removed from the current tree in 0.68.0; review reachable history before publication.

## 0.66.8 — 2026-09-23

- Queued a task-change email notification at the receiving site when the sender withdraws a cross-site request, subject to the site's and user's notification settings.

## 0.66.7 — 2026-09-23

- Kept a source task in the active overview when it has a sent side request; the request remains a separate sent-request count.
- Showed answered sent requests under **Requires action** until the sender closes them, without silently completing the source task.
- Included sent side requests in annual request statistics even though the operational task list keeps them beneath their source task.

## 0.66.6 — 2026-09-22

- Kept tasks registered directly at the site's designated leadership unit visible in the top-level task view throughout planning and release.

## 0.66.5 — 2026-09-22

- Kept subordinate workload list columns aligned across units regardless of status-text length, including child-site rows.

## 0.66.4 — 2026-09-22

- Made predecessor selection available when putting work on hold, including during and after plan approval.
- Moved approved-plan release into the task card's `Next step` actions, with `Wait` and `Release`; plan viewing is read-only and planned requests are not offered again.
- Replaced raw JSON as the default approval-version view with readable sections and highlighted changes between versions of the same object.

## 0.66.3 — 2026-09-22

- Separated formal plan approval from operational release. Approval no longer dispatches delegated work or cross-site requests; leaders may hold or complete planning before release.
- Kept approved plans visible as an action requiring a leader, including after a hold is resumed.
- Restored each delegated item's own task text as the primary content and collapsed the parent plan as optional context.

## 0.66.2 — 2026-09-22

- Planning accepts a complete multiline task list for each receiving unit in one text field, without adding tasks one by one.
- Preserved line breaks when the delegated work item description is viewed.
- Planned delegations now autosave during drafting, including edits and removal, just as planned cross-site requests do.

## 0.66.1 — 2026-09-22

- Planning now adds multiple numbered tasks to the same receiving unit while retaining one delegated work item per unit.
- The same plan can include several receiving units and requests to other sites; planned recipients remain visible while adding more.
- Expanded plan-allocation text capacity and restored child-site recipients in the planning selector.

## 0.66.0 — 2026-09-22

- Added immutable, numbered approval snapshots with SHA-256 integrity hashes and separate formal sign-off records.
- Connected formal versioning to approved plans, approved final reports, accepted request responses and recorded decisions.
- Added task-context approval history with side-by-side version comparison while keeping technical audit events separate.
- Included formal versions and sign-offs in portable site exports and prepared the model for configurable, multi-approver workflows.

## 0.65.0 — 2026-09-22

- Added an open, versioned, site-scoped customer-exit export package using ZIP, JSON Lines, original attachment formats and SHA-256 integrity metadata.
- Added authorization and audit evidence for exports plus non-mutating package validation with strict site-boundary, version, path, size, JSON, identifier and integrity checks.
- Added Platform Manager controls for downloading and validating site packages and documented the public format independently of a running Fylkren installation.
- Kept portable export/import separate from installation backup/restore and excluded authentication and infrastructure secrets.

## 0.64.0 — 2026-09-22

- Added site-isolated risk and mitigation management for task, assignment, plan and execution contexts.
- Added immutable risk and mitigation revisions, derived and residual risk, accountable actions, API support, contextual task UI and audit history.

## 0.63.0 — 2026-09-22

- Added stable, versioned domain events separated from external webhook delivery.
- Added asynchronous signed webhooks with subscriptions, retries, timeouts and delivery history.
- Improved dependency and decision dialog structure and made dependencies available when putting assessed or planned work on hold.

## 0.62.0 — 2026-09-22

- Added decisions as stable, first-class domain records separate from technical audit events.
- Added append-only numbered revisions retaining decision text, rationale, status, timestamps, makers and typed object references.
- Added task-context decision viewing and recording, API creation/revision support and site-audit evidence.
- Prepared immutable revisions for later formal approval/sign-off without implementing that policy yet.

## 0.61.0 — 2026-09-22

- Added typed finish-to-start dependencies between same-site tasks, including multiple predecessors and automatic blocked-state calculation.
- Added cycle, duplicate, self-reference and cross-site validation for task dependencies.
- Added searchable dependency administration, blocked-state presentation, API exposure and site-audit events.
- Kept the relationship model extensible without adding advanced scheduling, critical-path or Gantt functionality.

## 0.60.61 — 2026-09-21

- Kept internally created subordinate tasks actionable only at their owning organizational level.
- Removed those tasks from superior task queues and superior “Requires action” lists while retaining recursive workload aggregation.
- Added recursive workload summaries for leaders at every organizational level, including deeper units and attached child sites.
- Changed subordinate workload bars to use an explicit active-work scale with a five-task minimum instead of always rendering the busiest unit at 100 percent.

## 0.60 — quality and security baseline

- Completed the structural source, database-query and repository-quality review before internationalization.
- Split oversized feature files, consolidated repeated rules and introduced enforceable source-size limits.
- Added repeatable API, frontend, Compose, repository and container-image verification gates.
- Hardened browser and machine authentication, session lifetime, CSRF protection, request authority, rate limiting, replay protection and local password controls.
- Added secure password reset, TOTP, WebAuthn/passkeys and configuration switches for deployments that disable local MFA.
- Strengthened upload validation, rich-text sanitization, secret masking, audit actor snapshots and retained security state.
- Added database indexes, concurrency controls, bounded operational stores and query splitting where appropriate.
- Reset the development database once to establish the final migration-backed baseline; subsequent upgrades use versioned migrations without destructive reset.

## 0.50 — platform APIs and administration

- Added scoped machine identities and the versioned administration API for sites, global users and classifications.
- Added the read-only report API with exact site/level grants and separate classified-report permission.
- Moved API-client and report-API administration to Platform Manager.
- Added searchable global user administration, site transfers, bulk cleanup, identity-source visibility and preserved historical attribution after deletion.
- Added Platform Manager pages for classifications, SMTP, notification templates, platform audit and operational logs.

## 0.40 — complete operational workflow

- Established the core process: task or request → optional planning → execution → final reporting.
- Added recursive organizational levels, parent/child sites, movable site relationships and durable return routing for established task chains.
- Added internal delegation and requests, cross-site requests with controlled disclosure, cancellation, reassignment and reporting back through every level.
- Added configurable planning and execution workflows, templates, timelines, autosave and responsibility transfer with retained history.
- Added structured final reports, approval, per-level archives, printing/PDF presentation and classification headers/footers.
- Added overview workload, deadlines, action requirements, pagination, search, permalinks and responsive mobile navigation.
- Added local users plus OIDC, SAML 2.0, Active Directory and LDAP identity linking.
- Added site notifications backed by a durable delivery queue and platform-managed SMTP templates.

## Earlier development

Earlier versions established the initial domain model, React/.NET/PostgreSQL stack, organization and personnel administration, task cards, planning, audit, white-label appearance and Docker Compose deployment. Those pre-baseline iterations were experimental and are intentionally summarized rather than retained as a second source of current behavior.
