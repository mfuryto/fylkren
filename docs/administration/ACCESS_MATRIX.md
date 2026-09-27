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
| `/api/work`, workflow and execution operations | Browser session | Active person, site and exact visible/led level | Responsibility owner or leader at that level, depending on action |
| `/api/platform/federation` | Browser session | Platform Manager role plus Enterprise entitlement for mutations | Platform Manager plus antiforgery; peer trust does not grant local site administration |
| `/api/federation/v1` | Signed peer protocol | Active pinned peer, addressed instance/site, routing state, entitlement, nonce and protocol signature | Only the bounded catalog/work message accepted by the exact route |
| `/api/v1/administration` | Machine identity | Explicit operation scope | Required write/move/assign/deactivate scope plus rate limit |
| `/api/v1/reports` | Machine identity | Exact report site/level grant plus `reports:read` | Read-only |

## Enforcement requirements

- Authentication is required by the global fallback policy except for explicitly documented public setup/login/configuration/health routes.
- Authenticated browser mutations under `/api` require centralized antiforgery validation. Machine APIs use Bearer credentials, scopes and separate limits.
- Object IDs in URLs or bodies are never authorization evidence; the endpoint loads and validates actual ownership.
- A Site Manager assignment alone does not enter operational task or execution queues. An active organizational placement or operational role is required independently.
- Read endpoints filter at the query; clients do not receive hidden content.
- Access to one task branch may expose necessary ancestor context but not sibling branches.
- A responsibility lock is not durable authority; every mutation revalidates current role or placement.
- Inactive person, site or membership grants no operational access even when historical links remain.
- Positive and negative integration tests must cover each matrix boundary before production use.
