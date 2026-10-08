# Product scope

This document defines the supported product boundary. The historical MVP has been delivered and is no longer a useful planning boundary.

## Purpose

Fylkren is a site- and organization-aware system for directing work as tasks and requests through assessment, optional planning, distribution, execution, final reporting, and durable documentation.

It is designed for organizations with an operational focus, including preparedness, public safety, defense-adjacent, public-sector, private, and voluntary organizations. This describes working style, not certification for classified or safety-critical use.

## Supported core

### Platform and sites

- multiple isolated sites in one installation;
- independent, parent, child, and recursively nested sites;
- durable site identities and movable hierarchy without rewriting active history;
- Platform Manager administration of sites, global identities, integrations, classifications, email, appearance, and platform audit;
- Site Manager administration of local organization, personnel, workflows, templates, notifications, and site audit;
- recursively aggregated capacity without automatic subordinate processing access.

### Identity and authorization

- local users with email, password policy, recovery, optional TOTP, and WebAuthn/passkeys;
- optional OIDC, SAML, Active Directory, and LDAP adapters;
- separation of person, sign-in identity, site membership, unit placement, and role assignment;
- leaders, delegated leaders, planners, ordinary members, Site Managers, and Platform Managers with distinct boundaries;
- server-side site, work-level, role, and object authorization;
- restricted tasks and centrally managed classification labels as separate concepts.

### Task and request management

- registration or receipt, leader assessment, priority, deadline, hold, rejection, reopening, and cancellation;
- optional planning with site-owned workflow, timeline, templates, proposal, return, and approval;
- direct or planned distribution to internal units and child sites;
- requests between sites and between internal levels with explicit information boundaries;
- multiple selectable execution workflows with autosaved rich text and timelines;
- release and reassignment of planning/execution ownership without history loss;
- report return through every responsible level;
- stable permalinks to tasks, planning, execution, and reports.

### Reports and records

- one approved final report at each responsible level;
- site and organization headers, author, approver, dates, and report classification;
- searchable, filtered, paginated report archive;
- print and local PDF export with classification on every page where applicable;
- permanent request response/receipt copies on both sides of a site boundary;
- separate operational history, audit, and technical diagnostics.

### Workflows and templates

- one site-owned planning workflow and multiple execution workflows;
- site- or level-owned execution definitions and step templates;
- standard planning, execution, and final-report templates for new sites;
- version-stable active and historical instances;
- rich text with Normal, H1–H4, unordered and ordered lists;
- timelines, document references, internal distribution, and follow-up fields.

### Integrations and operations

- versioned administration API for sites, global users, and classifications;
- versioned read-only report API with exact site/work-level grants;
- optional Enterprise AI assistance for task summaries, drafts, learning analysis and bounded questions, controlled centrally per Site;
- SMTP notifications using durable queueing, retries, templates, site policy, and personal muting;
- Docker Compose single-host deployment with web gateway, API, PostgreSQL, and persistent key storage;
- air-gapped runtime and offline-capable password screening;
- backup, upgrade, rollback, health, technical status, and security verification procedures.

## Deliberate boundaries

Fylkren does not currently provide:

- a generic document repository, document editing, or file synchronization;
- automatic import of an entire AD/LDAP directory into Personnel;
- SCIM provisioning;
- a plugin marketplace or general-purpose process engine;
- chat, video meetings, or a collaboration suite;
- native mobile or Windows applications;
- a general BI/report designer or full Gantt project-management suite;
- automatic translation of user content;
- autonomous AI decisions, approvals, access changes or cross-site routing;
- security accreditation or automatic clearance decisions;
- supported multi-node high availability in the core Compose profile;
- guaranteed exactly-once delivery across distributed nodes;
- automatic legal decisions about retention or sanitization.

Document links are references only. The platform does not upload or store the referenced local or remote document.

## Quality and release boundary

A production-ready release requires:

- the maintained end-to-end acceptance matrix completed from clean fixtures;
- the documented OWASP-based security verification and independent review;
- backup and matched key-ring restore evidence;
- representative single-host performance measurements;
- complete installation, upgrade, rollback, identity, API, and operations documentation;
- complete supported language resources after internationalization;
- no unresolved Critical or High security findings.

Current implementation status must not be confused with security accreditation or a guaranteed capacity tier.

## Future product decisions

The [roadmap](../project/ROADMAP.md) tracks final 1.0 testing, internationalization and the remaining independent review gate for implemented instance federation. The [Community/Enterprise architecture](../architecture/EDITION_ENTITLEMENTS.md) preserves one authoritative data model and upgrade path rather than forking the operational domain.
