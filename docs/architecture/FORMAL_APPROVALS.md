# Versioning and formal approvals

Fylkren keeps formal approval history separate from the technical audit log. The audit log records that an action occurred. The formal approval store records the exact domain content that was approved.

## Model

Each approved domain object produces an immutable `DomainObjectVersion` containing:

- site and work-item context;
- stable object type and object identifier;
- monotonically increasing version number per object;
- the exact approved content as a structured JSON snapshot;
- a SHA-256 integrity hash;
- approval status, creator and timestamp.

Each approval is represented by one or more `FormalApprovalSignoff` records. A sign-off stores the approver's stable person identifier, name snapshot, status, timestamp and an optional comment. The separate sign-off table allows later approval policies to require multiple approvers without changing the version format.

Approved versions are append-only. Editing operational data after an approval changes the working copy only. A later approval creates a new immutable version and never modifies an earlier approved version.

## Current approval points

The initial integration records formal versions when:

- a plan is approved;
- a final report is approved;
- a received request response is accepted and closed by the requesting site;
- a decision is recorded as a formal decision.

The plan snapshot includes its task context, ordered steps, documents, links, timeline entries, internal allocations and cross-site requests. The final-report snapshot includes report content, classification and authorship metadata.

## API and user interface

Authorized users can retrieve the approval history for a task from:

`GET /api/approvals/sites/{siteId}/items/{itemId}/versions`

The response includes the immutable content, integrity hash and sign-offs. The task interface exposes **Versions and approvals**, where users can inspect approval history and compare any two snapshots side by side. Plan steps, assignments, requests, reports and decisions are presented as labelled human-readable sections; changed fields are highlighted when two versions of the same object are selected. The original JSON snapshot remains available in a collapsed technical section for verification.

Tenant and work-item access checks are applied before version content is returned. Formal approval records are also included in a site's portable export package.

## Extension points

The model deliberately does not hard-code a single approval workflow. Future work can add approval requirements, ordered or parallel stages, rejection, delegated authority, quorum and additional domain-object types while retaining the same immutable version and sign-off history.
