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

Only leaf work that is actually being handled contributes to active workload. A superior tracking item waiting for an active child is not counted as a second workload item.

### Site-managed metadata

Task types, source types and senders are managed inside one site and may be deactivated for new work without breaking existing references. Cross-site transfers use immutable display snapshots and never populate or reuse the receiver's local registry IDs. `Request` is the system-managed request type.

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
        └── Final report

Platform and site administration ── Audit event
Domain notification event ── Delivery queue ── Delivery attempt
```
