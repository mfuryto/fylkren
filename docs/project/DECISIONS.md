# Product and architecture decisions

This register contains durable decisions that constrain the product or architecture. UI details, completed changes, and defect history belong in the manuals, changelog, and issue tracker.

IDs in this maintained register are unique and stable. Superseding a decision requires a new ID and an explicit reference; never reuse or silently rewrite an ID's meaning.

## Product and domain

### ADR-001 — Mission-oriented work management

Fylkren supports organizations that direct work as assignments through assessment, optional planning, distribution, execution, documentation, and reporting. It is not a document archive, generic ticket clone, or heavy BPM engine. Operational and preparedness organizations are important use cases, but the product is sector-neutral and makes no certification claim.

### ADR-002 — One main lifecycle

Tasks and requests use the same main lifecycle:

```text
Task or request → optional planning → execution → final reporting
```

Leader assessment precedes routing. Control follows execution, not planning. Every responsible level writes and approves its own final report.

### ADR-003 — History is preserved

Completed work is read-only history. Reassignment, release, return, cancellation, user deletion, organization change, or site movement must not rewrite prior attribution or processing. Invalid records are cancelled or sanitized through explicit audited operations rather than silently removed.

### ADR-004 — Levels lead; superior levels do not micromanage

An assignment is processed by its receiving work level. Superior leaders direct work, see capacity and official status, and receive reports. They do not inherit ordinary processing controls inside subordinate units. Explicit deputy authority can allow a person to act for a superior leader without collapsing the two work levels.

### ADR-040 — Task dependencies are typed, acyclic relationships

A task may depend on several same-site predecessor tasks. Dependency relationships have an explicit type and form a directed acyclic graph. The initial `finish_to_start` type blocks ordinary progress until every predecessor is completed. Blocked state is derived rather than stored. Advanced scheduling, automatic date propagation, critical-path calculation and Gantt presentation remain outside the initial dependency capability.

### ADR-041 — Decisions are versioned domain records

An operational decision is a first-class aggregate with a stable ID, not an audit-event interpretation. Its numbered revisions are append-only and retain decision text, rationale, status, decision time, makers and typed domain-object references. The audit log records that creation or revision occurred but does not replace the decision history. Formal approval can later reference a specific immutable decision revision.

## Sites and organization

### ADR-005 — Sites are durable isolation boundaries

One platform can contain multiple independent or hierarchical sites. Each site owns its internal organization, personnel assignments, managed reference data, workflows, operational records, and audit boundary. A parent relationship provides direction and reporting routes, not automatic administration or internal case access.

### ADR-006 — Site hierarchy is recursive and movable

A site can be both child and parent. Sites can move between parents or become independent without moving their local data. New work follows the current hierarchy. Existing chains retain their original sender/receiver relationship and report back along that recorded route.

### ADR-007 — Internal units and child sites are different objects

Internal units belong to exactly one site and are administered by that Site Manager. Child sites remain separate sites and appear read-only in a parent's organizational and workload views. A designated top leadership unit represents site top level but does not change the site's technical root.

### ADR-008 — Capacity aggregates without operational duplication

Active workload is counted at the receiving level and aggregated recursively for superior capacity views, including child sites. Superior aggregation must not create duplicate task instances, false **Requires action** entries, or operational authority.

## Requests and cross-site work

### ADR-009 — Requests use linked but separate records

A cross-site request creates a local tracking branch for the sender and a separate receiving task at the recipient site's top level. The sender sees coarse official status and one approved official response, never the recipient's internal planning, distribution, execution, people, or subordinate reports.

### ADR-010 — The site is the official cross-site sender

The sender shown across a site boundary is the originating top-level site's name. **Registered by** identifies the person. Type, source type, sender, site, and person are immutable snapshots and never populate or overwrite the recipient's managed lists.

### ADR-011 — Requests can originate at any authorized level

An authorized leader can create a request directly or as a branch in a plan. The tracking record remains at the originating work level and the response returns there. Internal requests within one site use ordinary internal visibility rather than cross-site filtering.

### ADR-012 — Official responses become reports and receipts

The receiving site's approved top-level final report is the official cross-site response. The responding site keeps its report; after acceptance, the requesting side stores a permanent receipt copy with the responding site's official header. Both copies remain traceable to the linked request.

## Roles and authorization

### ADR-013 — Platform Manager is a system role

Platform Manager administers platform operation: sites, global identities, API clients, email transport, global classification, appearance, and platform audit/technical status. The role belongs to the system, not a site, and gives no operational site-content access by itself.

### ADR-014 — Site Manager is an administrative role

Site Manager administers Organization, Personnel, Workflows, Templates, Notifications, and Site Audit. It does not grant ordinary access to Overview, Tasks, Planning, Execution, or Reports. Operational access requires a separate organizational assignment or role.

### ADR-015 — Operational authority is level-specific

Leaders act at their level, including planning and approval. Delegated leader authority can provide continuity. Planners read relevant tasks and write planning at their authorized level but do not approve as leaders unless separately empowered. Ordinary members read their level and write execution for assignments received by themselves or their team.

### ADR-016 — Administration is centralized at site level

Subordinate leaders can view relevant organization, roles, and personnel but cannot administer them. Site Manager performs those changes for the site. Workflow and template definitions remain usable by relevant operational users even though their administration is restricted.

## Identity

### ADR-017 — Person and sign-in identity are separate

One internal person can have local and external identity links and membership in multiple sites without duplicating historical attribution. Email is globally unique and can support sign-in, notifications, and controlled identity mapping. Platform Manager accounts follow a separate system lifecycle.

### ADR-018 — External directories are selected, not imported wholesale

AD/LDAP directories never automatically populate Personnel. Site Manager searches the configured provider and explicitly adds only required people. Stable provider identifiers link to the internal person; unit, role, authority, and site membership remain locally managed.

### ADR-019 — Local authentication is optional as one complete capability

Disabling local authentication disables both local sign-in and creation of new local users without deleting people or history. External-provider rollout must preserve a verified administrative recovery path. Directory-managed identities cannot bypass directory policy with local credentials.

## Workflows, templates, and content

### ADR-020 — Planning and execution are separate workflow directions

Each site has one site-owned planning workflow. Multiple execution workflows can be site- or level-owned and selected when execution starts. Definitions are visible site-wide for traceability and reuse, but only their owner can edit or deactivate them.

### ADR-021 — Active instances are immutable snapshots of definitions

Editing a workflow or template creates new definition state for future use. Active and historical instances retain the version and content with which they started. Releasing ownership never deletes completed step history.

### ADR-022 — Rich text is constrained and autosaved

Operational editors support Normal, H1–H4, unordered lists, and ordered lists through controlled rendering without raw HTML. Step content and timelines autosave with unobtrusive delay. Document references contain a name and address only; Fylkren does not store the referenced file.

### ADR-023 — Site-owned default templates provide a usable baseline

New sites receive editable defaults for planning, execution, and final reporting. Deleting or customizing a default is an intentional site decision and upgrades must not recreate deleted definitions.

## Reports, classification, and records

### ADR-024 — Reports are the archive entry point

Approved final reports and their completed chain are accessed through Reports rather than a competing archive page. Reports are level-specific, searchable, paginated, printable, exportable to PDF, and linkable by stable language-neutral identifiers.

### ADR-025 — Classification is central labeling, not authorization

Platform Manager maintains one global classification register. Labels follow relevant content and final-report output, including page headers and footers. They do not determine clearance, nationality, or access; site, level, role, and object rules remain authoritative.

### ADR-026 — Operational history, audit, and technical logging are separate

Domain history contains work content and state. Audit records traceable actions and actors. Technical logs contain service diagnostics. Platform and site audit are server-side isolated; later role changes do not reclassify historical events.

### ADR-027 — Retention supports preservation and controlled sanitization

Tasks and reports are normally retained as read-only history. The operating organization sets legal retention. Controlled sanitization permanently removes selected content while preserving a neutral audited fact that sanitization occurred. Backups require a corresponding retention policy.

## APIs and integrations

### ADR-028 — Browser and machine APIs have different trust models

Browser APIs use authenticated sessions and central CSRF protection. Versioned machine APIs use expiring one-time Bearer credentials, least-privilege scopes, rate limits, audit, and resource-specific grants. Internal browser endpoints are not public integration contracts.

### ADR-029 — Administration and reports are separate public contracts

The administration API manages sites, global users, and classifications but no operational content. The report API is read-only and exposes approved reports only through exact Platform Manager grants per site and work level. Platform administration of a report grant does not give the administrator personal access to its content.

### ADR-030 — Notifications use a durable site-aware outbox

Platform Manager owns shared SMTP transport and global templates. Site Manager selects event categories for each site; users can mute their own notifications without changing site policy. Delivery uses durable queueing, duplicate protection, bounded retries, visible status, and site context in the sender name.

## Architecture and deployment

### ADR-031 — Modular monolith and PostgreSQL

The supported core is a React/TypeScript web client, modular ASP.NET Core API, and PostgreSQL, deployed with Docker Compose on one host. New services are introduced only for a documented operational need. The API and database are not exposed directly through the default host profile.

### ADR-032 — Air-gapped operation is a core requirement

Runtime behavior, password screening, documentation, and supported updates must work without internet access. External identity, email, and update services are optional integration boundaries, not hidden runtime dependencies.

### ADR-033 — Data and cryptographic keys are backed up together

PostgreSQL and the matching persistent ASP.NET Data Protection key ring form one recovery set. Restoring only the database can make sessions and protected TOTP/SMTP material unusable. Backup and restore procedures must verify both.

### ADR-034 — Single-node deployment boundary (superseded HA proposal)

Superseded: the single-host profile is not high availability, and a separate multi-node operations product is no longer on the roadmap. Instance federation between independent installations does not change that deployment boundary.

## Product presentation and repository

### ADR-035 — White-label deployment with limited product branding

The deployed site name and appearance are customer-controlled. The only fixed in-product branding is `Fylkren (version)` in the lower navigation area. Product wording must not be inserted into customer-facing instructions, authentication issuer names, notifications, or operational content unless technically required.

### ADR-036 — Accessibility and responsive behavior are product requirements

Desktop and mobile use the same product shell. Mobile navigation is an overlay and must not displace content. Pages and dialogs must remain fully visible and operable after rotation, zoom, keyboard navigation, and reduced viewport height.

### ADR-037 — Repository language and product languages are separate

Repository-facing material is English. The application uses language resources, initially complete for Norwegian Bokmal (`nb-NO`) and English. Routes, permalinks, API contracts, IDs, and stored event types remain language-neutral.

### ADR-038 — Documentation is a maintained product surface

Canonical documentation lives under `docs/`, with `docs/README.md` as its portal. README introduces the product; changelog records completed releases; roadmap contains future work; this register contains durable decisions. Parallel manuals and chronological implementation diaries are not maintained.

### ADR-039 — Packaging remains product-neutral until decided

Superseded by ADR-040. This temporary deferral no longer applies to the 1.0 release.

### ADR-040 — One product with offline feature entitlements

Community and Enterprise share one source tree, set of API/web images, schema and upgrade path. Community works offline without a license. A signed offline license activates centralized Enterprise entitlements on the same installation. The server enforces every protected capability; a downgrade stops new Enterprise actions without deleting or hiding customer-owned data. Existing external identity links remain usable for authentication to prevent lockout. This decision supersedes ADR-039 and must be exercised before final 1.0 functional, integration and security testing. The Fylkren Source Available License 1.0 permits compliant redistribution while restricting Enterprise bypass and misrepresentation of product authorship; the source license and runtime entitlements remain distinct and require pre-release legal/commercial review.

## Superseding a decision

A proposal that changes one of these constraints must:

1. identify the affected ADR;
2. explain the operational and migration consequences;
3. define compatibility for stored data, APIs, and active work;
4. add a new ADR that explicitly supersedes the old one;
5. update the canonical manuals, roadmap, tests, and changelog in the same change.
