# Domain model

## Identity and history

Durable entities use locally generated globally unique IDs. Names, codes and human-readable task numbers are separate mutable fields. Import must stop on an existing identical entity or site ID; silently generating a replacement would break historical relationships.

One persistent UUID identifies the installation/database independently of its network address or display name. An implemented federated site or resource uses a composite instance/site/object address, rather than treating a local UUID as a cross-installation foreign key. Remote site-directory snapshots and work-correlation links are stored separately from locally owned domain objects; see the [federation architecture](../architecture/INSTANCE_FEDERATION.md).

History refers to the permanent person and entity IDs and records relevant actor, role, organization and display snapshots. Reorganization or account changes never rewrite past events. Active work moves only through an explicit audited operation.

## Core entities

### Platform

One installation containing platform configuration, identity providers, localization, classifications, health information and one or more sites.

### Site

A durable administrative, membership and access boundary with its own organization, members, roles, workflows, templates, tasks, reports and history. A site can be active or inactive and can be attached to an organizational unit in another site without losing its internal boundary.

### Organizational unit

A permanent or temporary unit inside one site. One explicitly designated unit represents the site's top leadership level and shares the top-level operational identity; it is not an additional work level. Other operational units own separate task, planning, execution and reporting contexts. Units with history are deactivated rather than physically deleted.

### Person and login identity

`Person` is the permanent internal actor referenced by history. A login identity is one authentication mechanism linked to that person: local credentials, Active Directory, LDAP, OIDC or SAML. A person may change or hold multiple identities without losing history.

### Membership, placement, role and assignment

A site membership connects a person to a site. Organizational placement records where the person belongs without granting a functional role. A role defines a function and permissions; a role assignment staffs that role with one or more people and may be time-bounded. A person without a functional role remains visible under the unit's unassigned grouping.

### Work item

The persisted task tree uses work items for primary tasks, delegated assignments, internal requests and cross-site request counterparts. A work item records durable and display metadata such as title, description, type/source/sender snapshots, owning site and level, priority, status, deadline and timestamps. Parent-child links preserve delegation and reporting paths.

Every work item has an internal UUID plus an immutable human-readable reference. Root references consist of the selected Site-owned task type abbreviation, or the Site fallback code when no type is selected, and an installation-wide forward-only number such as `INC-000123`. Delegations and requests append a sibling path such as `INC-000123-1` and `INC-000123-1-1`. The same value follows the work item through planning, execution, approval and its final report. Federated inbound work receives a local reference while preserving the origin instance ID and origin reference as provenance.

Only leaf work that is actually being handled contributes to active workload. A superior tracking item waiting for an active child is not counted as a second workload item.

### Site-managed metadata

Task types, source types and senders are managed inside one site and may be deactivated for new work without breaking existing references. Cross-site transfers use immutable display snapshots and never populate or reuse the receiver's local registry IDs. `Request` / `REQ` is the initial system-managed request type. Site Manager may customize its name and abbreviation while its system identity and active state remain protected. Request routing uses the system marker, not the display name or abbreviation. Existing task reference codes and cross-site display snapshots are preserved.

### Planning and execution

A workflow definition describes planning or execution steps. A template supplies optional initial rich text. Starting a workflow copies the configured initial content so later template changes do not modify active or completed work. Workflow responsibility may be released or reassigned while documents and history remain intact.

### Timeline and document reference

A workflow may contain a structured timeline. Document references contain labels and links; Fylkren does not store the referenced document file. References and their activity remain traceable without making the platform the document owner.

### Final report

Every operational level completes its own report after execution and subordinate reporting are complete. The report records content, classification, author, approver and organizational header snapshots. Approved request responses are archived by both communicating sides according to the site-boundary disclosure rules.

### Activity, audit and technical log

Activity is the readable operational history. Audit records security and administrative mutations, actor context and relevant old/new values. Technical logs describe application operation. The three streams have different audiences and retention rules.

### Notification delivery

Domain events project eligible notifications into a durable, deduplicated delivery queue. Delivery attempts and failure reasons are retained independently of the successful business transaction.

## Relationship overview

```text
Platform
└── Site ── optional parent attachment to another site's Organizational Unit
    ├── Organizational Unit
    │   ├── Membership / placement ── Person ── Login Identity
    │   └── Role ── Role Assignment ── Person
    ├── Workflow Definition ── Step ── optional Template
    ├── Site-managed metadata
    └── Work Item
        ├── child Work Item
        ├── Planning / Execution instance
        ├── Timeline / Document reference
        ├── Activity event
        ├── Final report
        └── Internal learning point ── Treatment / comment history

Platform and site administration ── Audit event
Domain notification event ── Delivery queue ── Delivery attempt
```

### Work-item comments

A comment belongs to one Site and work item and stores immutable plain text (1–10,000 trimmed characters), the author's person ID, an author-name snapshot and a UTC creation timestamp. Operational readers may contribute without claiming or managing the task. The existing task read boundary applies to both listing and posting. Comments remain available across workflow runs and after task closure; they do not alter formal task state or approved content. Lists return 20 entries per page, newest first, with an ID tie-breaker. Posting requires an authenticated session and antiforgery token and records `work-item.comment-added` in the Site audit. Site portability includes comments and their authors.

### Visual risk workspace

The task risk register links numbered rows to a 5 × 5 before/after matrix. Numbering follows immutable risk creation order, and the map uses the existing probability × impact boundaries (4, 9 and 16). Circle placement within a cell separates coincident assessments without changing their stored coordinates. Dragging or selecting a cell changes a draft; saving creates the next risk revision. A missing residual pair is represented as unassessed, with no residual marker. Risk creation accepts an optional first mitigation and saves both entities and their audit events in the same database transaction. Existing risk creation without an initial mitigation remains supported. Completing a mitigation preserves its owner and does not calculate a residual assessment automatically.

### Internal learning point and treatment history

A learning point belongs to a Site, one reporting work level and a work item. It records a stable task-local number, positive/improvement category, immutable original text and author snapshot. Status, priority, action plan, deadline, responsible leader and outcome form its current treatment state. Immutable entries retain every comment and treatment revision; a version token rejects conflicting updates. Points survive task completion and remain internal to their level instead of following final-report propagation. Full Site export/backup includes them for recovery. See [internal learning](../administration/LEARNING.md).

Operational feedback continues as **priority → delegation → status → learning → …**, informing future assessment, planning and execution. Learning is an operational record with its own treatment lifecycle, not an administrative task status or a terminal stage of the organization’s work. Closing a point preserves its outcome for reuse; it does not automatically create or alter a work item.
