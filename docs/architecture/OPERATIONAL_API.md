# Operational API foundation

Status: **initial coherent foundation delivered**. This document is the canonical requirement, architecture and test traceability reference for Fylkren's versioned operational machine API. Browser routes remain internal implementation contracts. Federation remains a separate signed peer protocol.

## Requirements

| ID | Requirement |
| --- | --- |
| OAPI-01 | Publish one machine-readable OpenAPI 3.1 document for every supported `/api/v1` operation. |
| OAPI-02 | Reuse signed-v2 machine identities, expiry, revocation, rate limits, structured errors and machine audit. Do not add bearer credentials or a second authentication system. |
| OAPI-03 | Separate scopes for operational read, work content, lifecycle transition, activity, decisions, risk, planning documentation and execution documentation. |
| OAPI-04 | Require an explicit exact Site/work-level grant in addition to scope. A grant does not inherit to parents, children or siblings. |
| OAPI-05 | Expose bounded reference/catalog, work-item, planning, execution, decision, risk/measure and activity reads without private learning or unrestricted report content. |
| OAPI-06 | Mutations reuse authoritative domain rules, use idempotency and optimistic concurrency, and record the machine actor in common activity plus the existing machine audit. |
| OAPI-07 | Human approval, identity administration, security configuration and irreversible lifecycle disposition are not implicitly granted by operational write scope. |
| OAPI-08 | Extend the existing webhook projection and catalogue for explicitly supported operational events; do not add a second event store or delivery mechanism. |
| OAPI-09 | Preserve existing `/api/v1/administration`, `/api/v1/reports`, browser and federation contracts. |
| OAPI-10 | Keep documentation, implementation, tests and ASVS authorization evidence traceable after every delivery stage. |

## Architecture

`ApiMachineIdentity` remains the caller identity. `ApiWorkGrant` binds that identity to one active Site and an exact work level; scopes and grants are both required. A null organization-unit ID represents Site top level. Object lookup returns `404` for absent and inaccessible objects to avoid cross-Site disclosure.

The operational API is rooted at `/api/v1/work`. Read projections query authoritative domain rows and do not create a second operational model. Work-item mutations use the existing domain entity rules, database reference allocator, lifecycle guards and dependency rules; browser antiforgery remains browser-only, while machine calls use signed requests. Work items and comments retain the creating machine identity without inventing a person. Common domain activity records machine actor, correlation and resource context. `ApiMachineAuditEvent` remains the security/accountability record for API use.

The OpenAPI document is served at `/api/v1/openapi.json` to authenticated machine clients. Contract changes follow the existing `v1` compatibility rules. Breaking field semantics require a new major path.

Decision, risk and measure revisions now retain either a person or machine recorder through mutually exclusive foreign keys. Decision-makers and risk/measure owners remain people. Planning and execution commands write only documentation in a human-owned active run and use the run's PostgreSQL concurrency version. They do not turn the operational API into an alternate approval or workflow engine.

## Delivery order and traceability

| Stage | Requirements | Implementation | Tests |
| --- | --- | --- | --- |
| 1. Access and read slice — delivered | OAPI-01–05, OAPI-09 | Exact work grants; signed catalog, item, comment, plan, execution, decision, risk/measure and activity reads; complete `/api/v1` OpenAPI document | Model migration/diff, exact-level positive/negative integration, scope/authentication, pagination and response-shape tests |
| 2. Coherent WorkItem commands — delivered | OAPI-02–07, OAPI-09 | Idempotent create/comment, optimistic content update and guarded non-approval transitions; explicit machine authorship | Browser regression plus machine create/replay, stale-version, comment actor, transition, state and grant tests |
| 3. Events and completion — delivered | OAPI-08–10 | Existing common activity, machine audit and webhook projection extended for the supported operations; API/access/security documentation reconciled | Webhook catalogue/actor contract, complete route and authorization inventory, documentation and candidate integration run |
| 4. Governed domain write slices — delivered | OAPI-02–07, OAPI-09–10 | Dedicated decision, risk, planning and execution scopes; explicit machine authorship; human ownership and approval boundaries; versioned documentation writes | Model/migration checks, OpenAPI command contract, scope and exact-grant authorization, validation and concurrency regression |

No stage enables irreversible deletion or anonymisation. Learning remains outside the general operational contract until its private exact-level policy has a separately reviewed API projection. Report mutations remain outside the operational API. Domain writes are never implied by `work:write`; every delivered slice uses its own scope and retains human-only approvals.
