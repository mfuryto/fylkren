# Work API

The Work API is the versioned machine interface for operational data. It uses the shared [API conventions](API.md), signed-v2 machine authentication and the Enterprise `machine-api` entitlement.

Base path: `/api/v1/work`

## Access model

Every request requires both a scope and an exact Platform Manager grant for one Site and work level. `organizationUnitId: null` identifies Site top level. A grant does not inherit upward, downward, sideways or across Sites. Direct object requests return the same `404` for an unknown and an inaccessible object.

| Scope | Capability |
| --- | --- |
| `work:read` | Read catalog, work items, planning, execution, decisions, risks and measures |
| `work:write` | Create and edit work items and add comments |
| `work:transition` | Perform the explicitly supported non-approval status transitions |
| `activity:read` | Read the bounded activity projection for a granted work item |

Platform Manager creates the client under **API**, then assigns its exact Site/work-level access in **Operational API access by Site**. Removing either the scope or grant stops access immediately.

## Reference catalog

`GET /catalog?siteId={siteId}` returns the granted active work levels plus active task types, source/sender lookups and applicable workflow definitions. It does not confer access to work at another level.

## Work items

`GET /items?siteId={siteId}&unitId={unitId}&status={status}&search={text}&page={page}&pageSize={pageSize}` lists one exact level. Page size is 1–100 and search is at most 200 characters.

`GET /items/{itemId}` returns the operational item, immutable references, assignment, content, current status, dependency links, direct children and PostgreSQL concurrency version. Report bodies remain in the separately granted Report API.

`POST /items` creates an ordinary local work item at the exact granted level. It requires `Idempotency-Key`. Request-type dispatch remains in the human/federation workflow because recipient selection and representation of a human sender cannot be inferred from a machine identity.

`PUT /items/{itemId}` updates bounded title, description, recommendation, link, priority and due date. It requires the latest response `ETag` in `If-Match`. Closed or archived information remains protected by the existing domain and lifecycle guards.

`POST /items/{itemId}/comments` adds a comment attributed to the API client and requires `Idempotency-Key`. `GET` on the same path returns bounded, paged comments with either person or machine attribution.

`POST /items/{itemId}/transitions` supports `registered → under_review`, `under_review → on_hold/rejected` and reopening from `on_hold/rejected → under_review`. It requires both `Idempotency-Key` and `If-Match`. Assignment, planning/execution responsibility, approval, report approval/completion, cancellation and lifecycle disposition remain human-governed workflows.

## Related operational views

- `GET /items/{itemId}/planning`
- `GET /items/{itemId}/execution`
- `GET /items/{itemId}/decisions`
- `GET /items/{itemId}/risks`
- `GET /items/{itemId}/activity?eventType={type}&from={time}&until={time}&limit={1..100}`

Planning and execution return the current authoritative run, step structure, documents and timeline. Execution also returns external request state. Decision and risk responses return the latest retained revision for each stable object; risk measures include their latest revision. Activity returns identifiers and provenance but omits domain payloads and private metadata.

Private learning, identity/security administration, human approvals, lifecycle disposition and unrestricted reports are outside this contract. Decisions, risks, measures, planning and execution are read projections in this first coherent operational slice; adding machine commands for them requires an explicit actor and approval policy rather than impersonating a person.

## OpenAPI

An authenticated machine client can read `GET /api/v1/openapi.json`. The document is the discovery contract; this manual explains authorization and information boundaries that remain mandatory even when a generated client is used.
