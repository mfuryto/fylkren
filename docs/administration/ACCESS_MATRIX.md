# Access matrix

This is the authoritative baseline for UI, API and authorization tests. Every decision is evaluated against the authenticated person, active role/membership, site and exact organizational level.

| Role or relationship | Administration | Operational access |
| --- | --- | --- |
| Platform Manager | Platform operation, sites, identities, email, classifications, appearance, APIs, technical logs and platform audit | No automatic site-content access |
| Site Manager | Organization, personnel, roles, workflows, templates, notifications and site audit in assigned sites | No automatic Overview, Tasks, Planning, Execution or Reports access |
| Dedicated leader | Read-only organization/personnel view for own subtree | Assess, prioritize, plan, delegate, approve, return, wait, reject, reassign responsibility and report at own level |
| Delegated/acting leader | No site administration | Same operational authority as the dedicated leader for the granted level and period |
| Planner | No administration | Read tasks and read/write planning at assigned level; approval requires separate leader authority |
| Role member | No administration | Read level tasks and work on assignments addressed to the person's role or team |
| Explicit archive custodian | No administration | Read the entire assigned locked/archived Site through dedicated archive routes; export requires a separate grant flag. No operational membership/actions are implied. |
| Unit member without work role | No administration | Read/write Execution at the person's organizational level; no planning or leader decisions |

Rights are additive, but administrative status never widens the scope of an operational role. A person who is both Site Manager and planner receives the two independent capabilities, not site-wide operational leadership.

## Organizational rules

- Site top level and the designated top-leadership unit are one operational level and share queues, reporting and counters.
- Superior leaders can task subordinate units, see aggregate capacity and receive formal status/reports; they cannot edit subordinate internal processing.
- A subordinate unit sees and acts on work assigned to its level.
- Internally created subordinate work does not become an ordinary superior task or superior action requirement.
- A parent site sees its cross-site assignments and returned status/reports, not the child site's personnel, local work or internal processing.
- Site movement changes future routing, not established task chains or historical access boundaries.

## Delegated authority

An organizational unit may `work at parent level`, giving its members an additional read/work scope at the direct parent level according to their roles. It does not remove the unit's own scope or grant leader/administrative authority.

A specific active leader assignment may be granted `may act as leader at parent level`. This is an audited person-assignment grant, not a property inherited automatically by future occupants of the protected leader role. It preserves the deputy model without granting the superior leader write access to subordinate internal work.

All dedicated and delegated leaders can plan at their own level without an additional planner flag. Leaders can release or reassign planning/execution responsibility at that level without deleting work or history.

## Identity administration

Platform Manager may create a local account directly in a selected site, manage the global user directory, transfer users between sites and use a justified time-limited identity-mapping elevation. None grants operational content access.

Site Manager manages people, memberships, placements and roles inside assigned sites. Account creation or placement never creates an artificial default role. Leaders cannot create accounts or administer personnel merely because they can read organization/personnel pages.

## Endpoint boundaries

| Endpoint area | Authentication | Boundary | Write authority |
| --- | --- | --- | --- |
| `/api/platform/*`, platform audit and API clients | Browser session | Platform Manager role | Platform Manager plus antiforgery token |
| Site access/workflow/template/notification/audit administration | Browser session | Active Site Manager assignment | Site Manager in the same active site |
| `/api/information/governance` | Browser session | Platform Manager; explicit owner/root/version and bounded reason | Reversible lifecycle and custody administration plus antiforgery |
| `/api/information/archives` | Browser session | Active person/login with a current explicit grant to a locked/archived Site | Read-only; portable export additionally requires `CanExport` |
| `/api/work`, workflow and execution operations | Browser session | Active person, site and exact visible/led level | Responsibility owner or leader at that level, depending on action |
| `/api/platform/federation` | Browser session | Platform Manager role plus Enterprise entitlement for mutations | Platform Manager plus antiforgery; peer trust does not grant local site administration |
| `/api/federation/v1` | Signed peer protocol | Active pinned peer, addressed instance/site, routing state, entitlement, nonce and protocol signature | Only the bounded catalog/work message accepted by the exact route |
| `/api/v1/administration` | Machine identity | Explicit operation scope | Required write/move/assign/deactivate scope plus rate limit |
| `/api/v1/reports` | Machine identity | Exact report site/level grant plus `reports:read` | Read-only |

### Complete endpoint-to-rule reconciliation

The source inventory contains 287 registered HTTP operations across 94 endpoint source files: 103 GET, 114 POST, 45 PUT and 25 DELETE operations. The maintained inventory test assigns every source containing an operation to exactly one control family and fails when the operation count changes. A mixed source file belongs to the narrowest applicable family below; individual routes still apply every more restrictive rule declared on the route or enforced after loading the resource.

| Control family | Routes and components | Consumer permission | Resource attributes | Field and response boundary |
| --- | --- | --- | --- | --- |
| `public-bootstrap` | Health, public configuration and public branding; the authenticated branding administration routes share the Platform Manager rule | Anonymous only where `AllowAnonymous` is explicit; Platform Manager for mutations | Fixed public resources; bootstrap eligibility and current installation state | Public responses contain display configuration or health only; branding writes use the administrative request contract |
| `identity-session` | Session, local login/reset, profile, passkeys, OIDC, SAML and directory administration | Explicit anonymous authentication action, current account for self-service, or Platform Manager for provider/directory administration | Login identity, linked person, provider namespace, current security version and current-password/factor proof | Authentication responses remain generic; profile and credential operations return only self-owned metadata; provider secrets are never returned |
| `machine-api` | `/api/v1/administration`, `/api/v1/reports`, API-client management and report-grant management | Active machine credential plus the exact operation scope; Platform Manager for client/grant administration | Machine identity, expiry, feature entitlement, idempotency/ETag and exact Site/level report grant | Administration DTOs are allowlisted; report content requires `reports:read`, the matching grant and its classification flag |
| `federation` | Browser federation management and signed `/api/federation/v1` protocol operations | Platform Manager for trust/routing management; pinned and signed active peer for protocol messages | Instance/site address, publication or routing grant, entitlement, key, nonce, message state and referenced object ownership | Protocol DTOs expose the bounded catalog or work-message contract; local personnel, internal processing and unrelated Site data are excluded |
| `archive-portability` | Archive reader and Site export/import validation | Current explicit archive-custodian grant; separate export flag, active Site Manager authority, or the specifically documented portability operation | Exact Site, lifecycle state, grant validity, export ownership/digest/version and requested archived object | Read-only archive projections and bounded export packages preserve history; authentication secrets are excluded and internal learning requires authorized full-Site export |
| `platform-governance` | Platform configuration, operations, audit, webhooks, licensing, lifecycle governance and preservation | Platform Manager | Exact governed owner/root/version, lifecycle state, hold/policy binding, feature entitlement and bounded reason where required | Technical and governance projections only; operational Site content is not conferred by the platform role |
| `site-administration` | Organization, access, Site Manager assignment, notifications, templates, references and Site audit | Platform Manager where explicitly declared, otherwise an active Site Manager assignment in the same Site | Exact active Site, person/membership/unit ownership, organizational hierarchy and configuration owner | Administrative projections do not expose operational work; audit and personnel queries are filtered to managed Sites |
| `operational-work` | Work items, planning, execution, decisions, risks/measures, learning, reports, approvals, workload and activity/lifecycle views | Active operational membership, role, responsibility or leader authority required by the action | Exact Site and organizational level, object owner/root/branch, assignment/responsibility, status/lifecycle, report grant and current relationship | Queries filter before paging; learning remains exact-level/private, cross-Site responses use snapshots, classified reports and ancestor context follow their explicit rules |

This table is the function and data authorization inventory for the registered API surface. The role matrix above defines the consumer permissions, while the resource-attribute and field columns define the mandatory object and response checks. The source test [test-authorization-documentation-inventory.mjs](../../tools/test-authorization-documentation-inventory.mjs) prevents an endpoint change from silently bypassing reconciliation. Dynamic positive and negative evidence remains in the tests named by the ASVS matrix; this inventory does not replace those tests.

### Field-level read and write rules

API request contracts and explicit response projections are allowlists: unknown fields are not dynamically bound to domain objects. Authorization is still evaluated for protected fields and cannot be inferred from a field being present in a request. These rules cover stored fields, derived projections, exports, activity metadata and integration messages.

| Field class | Read rule | Write rule | State and resource attributes |
| --- | --- | --- | --- |
| `authentication-secret` | Password hashes, reset verifiers, TOTP secrets, passkey material, session cookies, API tokens and private signing keys are never returned; a generated reset grant or API token is returned only once to the authorized creator | Only the owning reauthenticated identity may change its password/factors; bounded Platform/Site administration may issue a reset without reading the credential | Current identity/person, provider ownership, current-password or factor proof, security version, reset expiry/use and administrator scope |
| `self-profile` | The authenticated person reads their own profile and factor metadata | The same person writes allowlisted display/email/image fields; sensitive changes require current-password verification | Current identity link, active account/person, directory-managed restrictions and optimistic/concurrency state |
| `personnel-administration` | Platform Manager reads the global directory; an active Site Manager reads people, placement and role data only in managed Sites; operational leaders receive the documented read-only subtree view | Platform Manager may perform global account operations; Site Manager may change Site-owned memberships, placements and roles only in the managed Site | Person activity, exact Site, membership/assignment owner, organizational subtree, shared identity ownership and last-manager/lockout safeguards |
| `work-content` | Operational fields, documents, dependencies, decisions, risks and measures require visibility to the exact Site, level and task branch | Each field group requires its action-specific leader, planner, responsibility or member authority; locked/archived content rejects ordinary edits | Site/level, branch ancestry, assignment/responsibility, workflow phase, lifecycle state, version and current role/placement |
| `cross-site-official` | A sender sees address/status snapshots and the approved official response; it cannot read the receiver's internal task, plan, execution, people, learning or drafts | The receiver controls internal fields; only bounded assignment, progress, cancellation and approved-response contracts cross the relationship | Persisted work link, origin/receiver address, current routing/trust, terminal state and immutable sender/receiver snapshots |
| `private-learning` | Point text, discussion, treatment and activity are visible only at the exact originating work level; they are excluded from final reports, superior activity and ordinary report archives | Exact-level authorized members submit; leaders at that level prioritize, comment and treat each point independently | Origin Site/unit/work item, lesson status, exact-level authority and task lifecycle independent of learning treatment |
| `classified-report` | Operational readers still require normal report visibility; machine clients additionally require the exact Site/level grant and `IncludeClassified` for classified content | Final-report authors and approvers require the normal responsibility/leader rule; machine report access is read-only | Work/report completion and approval state, exact Site/level grant, classification value and grant flag |
| `audit-activity` | Platform audit requires Platform Manager; Site audit requires the managed Site; operational activity first applies current object visibility and private-learning filtering | Callers do not edit history; trusted server operations append audit/activity with independently authorized domain changes | Audit owner Site, actor/source, resource owner/root, event visibility, archive custody and correlation—not metadata supplied by a client |
| `integration-secret` | SMTP passwords, directory bind passwords, OIDC/SAML client secrets and private federation keys are write-only or represented by a configured/not-configured indicator | Platform Manager may replace them through the relevant protected configuration route; peer messages cannot set local configuration | Platform role, Enterprise feature where applicable, protected-at-rest representation, destination policy and current provider/peer identity |
| `archive-export` | Archive fields require explicit current custody; full export additionally requires export authority. Packages preserve authorized history while excluding authentication/integration secrets | Archives are read-only; acknowledgement/validation and reversible governance operations use their own explicit grants and never rewrite historical object fields | Site owner/root, locked or archived state, custody validity, `CanExport`, package digest/version and preservation hold/policy |

Adding a protected request or response field requires assigning it to one of these classes or documenting a new class, then adding positive and negative coverage for the applicable consumer and resource state. The maintained [field authorization documentation test](../../tools/test-field-authorization-documentation.mjs) locks this inventory to the existing private-learning, classified-report, portability and cross-Site boundary tests.

## Enforcement requirements

- Authentication is required by the global fallback policy except for explicitly documented public setup/login/configuration/health routes.
- Authenticated browser mutations under `/api` require centralized antiforgery validation. Machine APIs use Bearer credentials, scopes and separate limits.
- Object IDs in URLs or bodies are never authorization evidence; the endpoint loads and validates actual ownership.
- A Site Manager assignment alone does not enter operational task or execution queues. An active organizational placement or operational role is required independently.
- Read endpoints filter at the query; clients do not receive hidden content.
- Access to one task branch may expose necessary ancestor context but not sibling branches.
- A responsibility lock is not durable authority; every mutation revalidates current role or placement.
- Inactive person, site or membership grants no operational access even when historical links remain. An active archive custodian has a separate read-only archive entitlement while the Site is locked/archived; revocation and reopening immediately invalidate it.
- Positive and negative integration tests must cover each matrix boundary before production use.
