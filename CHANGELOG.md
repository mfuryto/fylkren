# Changelog

This file records durable, user-visible release changes. Detailed implementation history remains available in Git and is not duplicated here.

## Unreleased

- Harden outgoing HTTPS integration traffic with checked DNS/IP destinations, explicit private-origin approval and bounded identity/federation downloads. Prepare SAML metadata through this shared path while preserving signed SSO and local administration on provider failure; require direct metadata responses and disable artifact resolution. See upgrade notes for internal integrations.

- Speed up pending-work menu counters with a database aggregate instead of materializing full task cards; preserve existing role/level boundaries, dependency and request-progress semantics, planning/execution ownership and private-learning counts.

- Clarify execution activity with step number/name and separate documentation edits, step selection and external follow-up; repeated unchanged saves no longer create new activity/audit entries or replace timeline records. Retain existing history.

- Automatically lock terminal tasks and archive them after operational follow-up and required delivery resolve; preserve explicit reopening for editing, find retained tasks with the Archived filter, and continue private learning treatment independently. Chain cancellation preserves already terminal history. Site/global-user retirement remains administrative; deletion and anonymisation remain disabled.

- Show information state as a green square, red padlock or blue archive icon; identify the selected resource and clarify Site/user archive guidance with administration controls below the primary action. Rename Site removal to Deactivate and its retained status to Inactive.

- Retired the live audit-derived notification projector after resumable legacy reconciliation, unified webhook projection bookkeeping, and added typed machine/system activity for Site and access lifecycle effects.

- Added consistent snapshot exports with lifecycle/federation evidence, verified export custody and versioned preservation holds/rules; protected held/archived records from existing federation transport cleanup without enabling permanent deletion.

- Added reversible Site/global-user locking and archival, explicit full-Site archive custody and a read-only Archives workspace; corrected navigation when Platform Manager also manages a Site.

- Show Active/Locked/Archived beside Lock/Archive, shorten the dialog, and localize locked-content and lifecycle conflicts instead of reporting them as concurrent edits.

- Extended the shared activity history to decisions, risks, mitigation actions, comments, exact-level private learning and remaining planning/follow-up edits while preserving existing notifications, webhook contracts and independent audit.

- Placed closing/archiving controls and reason labels on separate rows using the shared accessible field layout.

- Clarified closing and archiving with the current information state, explicit action selection, action-specific reasons and explanations of locking, restoration and retained history.

- Added authorized WorkItem and Site activity timelines over the existing event store, with correlated independent audit, notification/webhook projection and signed federation delivery.

- Added explicit WorkItem information closure, archive and restoration with relationship checks and database guards. Irreversible deletion, anonymisation and retention-policy execution remain disabled.

- Bound pending TOTP sign-in challenges to the account security version so logout, password changes and factor changes invalidate earlier challenges.

- Added repeatable release browser/authenticator and workload verification, private-learning exclusion checks for PDF/federation, and updated security evidence.

- Handled rejected WebAuthn authenticator responses with bounded authentication errors instead of server errors.

- Run PostgreSQL directly as its dedicated user with dropped capabilities and no privilege escalation.

- Upgraded Alpine packages in the PostgreSQL image to remove an available dependency vulnerability, and added a clear keyboard focus outline to form fields.

- Aligned the Tasks due-date column across rows by giving reference and status columns consistent widths, including when a task is opened.

- Made individual learning-point treatment clearer with clickable status controls for leaders, explicit opening instructions and an explanation for users with read-only treatment access.

- Restarted numbering separately for each final-report learning list and moved learning categories into a compact green/red indicator column before the observation text.

- Documented learning as continuous operational feedback after status, and added an illustrated workspace gallery and user-manual examples for Overview, Tasks, Planning with its timeline ruler, Execution, report archives and final-report presentation.

- Added separate internal learning points to final-report writing and a compact Learning queue with task references, priorities, comments, accountable treatment, deadlines, immutable history and pending navigation counts. Learning stays within the reporting work level and is excluded from final-report forwarding.

- Added localized help buttons and keyboard-accessible help dialogs to Workload, Reports, Intake and Notifications.

- Allowed Site Manager to rename and abbreviate the system request type while retaining its protected active state, routing identity and existing reference codes.

- Restricted fallback Site code editing to Platform Manager's existing References page and removed the code section from Site Manager's References. Existing task references remain unchanged.

- Compacted Platform Manager status counters, service and log rows, action buttons, administration sections, delivery summaries and the licence certificate while retaining its branding and entitlement details.

- Added a dedicated due-date column after the task title in the Tasks list, with localized dates and a compact stacked layout on narrow screens.

- Removed the redundant Report Archive heading, made report titles open the viewer, and included search-aware report counts in each year option and All years.

- Applied heading-based opening and closing with inline copy-link actions to Planning and Execution cards as well.

- Tasks now open and close from the heading with keyboard support; the copy-link action sits beside the status in the same header instead of occupying a separate row.

- Further compacted collapsed and expanded Tasks, Planning and Execution cards, including metadata, action controls and nested work details.

- Made Overview task statistics content-sized inline counters instead of full-width cards, with wrapping labels and compact spacing.

- Applied compact screen spacing throughout shared panels, forms, buttons, lists and dialogs. Touch controls retain larger targets and printed report layout remains unchanged.

- Reduced Overview header, summary cards, subordinate cards and statistics spacing across all overview designs, with compact controls and responsive mobile headings.

- Compacted the Tasks queue controls: view, search and sorting share one desktop row, status counts use small inline cards, and successful registration preserves the current filter and search.

- Prevented a successful task registration from showing a false unavailable-task warning by confirming direct task access instead of treating absence from one queue projection as an authorization result.
- Added immutable human-readable task references based on Site-managed task type abbreviations and one installation-wide collision-safe sequence. Delegations and requests extend the parent reference, and the same reference now follows work through Tasks, Planning, Execution and Reports. Federated origin references remain separate provenance metadata; final-report display, print/PDF, approval versions, archive and Report API retain both values. Site Managers configure task types under **References** and manual source/sender registries under **Intake**; externally received senders remain snapshots.
- Added visible sorting to primary queues and administration lists, with newest-first task type management, server-side ordering for paginated work queues and preserved semantic order for workflows and hierarchies.
- Fixed task registration so the returned task becomes the active permalink and stale list responses cannot leave a false missing-or-inaccessible warning above a successfully created task.
- Made final-report templates and planning/execution workflow labels permanently Site-owned after creation. New Sites receive editable English copies, upgrades no longer replace them, and a guarded repair restores untouched legacy defaults plus malformed literal newline escapes without changing customized Site content.
- Added complete, selectable language packs for Swedish, Danish, Finnish, German, French, Polish, Spanish, Italian, Ukrainian, Dutch, Portuguese, Czech, Romanian, Estonian, Latvian and Lithuanian. All packs pass the maintained catalog, terminology, locale, interpolation and source-language leakage checks. Fixed regional clock-format locale extensions so the selected pack applies to the complete interface instead of only the navigation.
- Moved the default GUI language, time zone, clock format and measurement system from deployment environment variables into persistent Platform Manager settings. Completed the migration of user-visible source text to typed language catalogs, with American English as source/fallback, reviewed British wording and Norwegian as an explicit GUI locale. Repository checks prevent new Norwegian prose from entering source code or documentation outside locale resources.
- Replaced the pre-release PolyForm Perimeter terms with the project-specific Fylkren Source Available License 1.0: compliant redistribution remains permitted, while Enterprise bypass and passing Fylkren or a substantially derived product off as independently created are prohibited. Legal verification remains a public-release gate.
- Added a maintained isolated real-time license-expiry test that proves immediate Enterprise-to-Community downgrade, server-side entitlement closure, retained customer state, paused webhook processing and renewal without restart.
- Completed GUI-managed AD/LDAP/OIDC/SAML identity hardening and maintained live laboratories. External links are bound to the exact OIDC issuer or SAML IdP Entity ID and can be safely removed/relinked. Tests now cover trusted TLS, one-time environment import, protected secrets, LDAP injection, scheduled/manual deprovisioning, disabled/expired/missing accounts, malformed or ambiguous directory data, invalid binds, preserved people/access history, direct-SSO emergency presentation and cancellation, wrong OIDC nonce/audience, forged state, unsigned or tampered SAML, replay rejection and atomic callback failure without a retained session.

These changes target the first public `v1.0.0` release. Pre-1.0 development
build identifiers are not public releases.

- Redesigned Platform Manager's License page as a branded, responsive digital certificate with explicit signature, instance-binding, customer, validity and entitlement presentation. Added the THUNOLD-OLSEN Licensing mark shared with the issuer portal.
- Established one authoritative development version file and a documented Semantic Versioning/GitHub Releases process. Public release history and supported update notifications begin with `v1.0.0`.
- Prevented pre-deactivation login cookies from becoming valid again after an account is reactivated. Password changes, password resets and administrative identity transitions now have maintained negative session-replay and concurrent reset-code tests.
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
