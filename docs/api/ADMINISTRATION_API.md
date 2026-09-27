# Administration API

Machine administration is an Enterprise entitlement (`machine-api`) in the one-image 1.0 architecture. Authorization scopes remain necessary but do not replace the server-side entitlement check; without it, protected requests return `403` with `enterprise_entitlement_required`. Existing site and user data remains available through ordinary authorized Community views and portable export. See [edition entitlements](../architecture/EDITION_ENTITLEMENTS.md).

The administration API lets an external administration system manage Fylkren's platform structure without access to operational work content. It covers sites, global users, and the global classification register. Tasks, plans, execution records, and reports are outside this contract.

Base path: `/api/v1/administration`

Shared authentication, errors, rate limits, and versioning follow the [public API conventions](API.md).

## Scopes

| Scope | Capability |
| --- | --- |
| `sites:read` | List sites, read a site, and list valid placement targets |
| `sites:write` | Create and edit sites |
| `sites:move` | Change a site's parent relationship |
| `sites:deactivate` | Deactivate a site |
| `users:read` | Search global users and read user details |
| `users:assign` | Assign an unassigned user to a site |
| `users:move` | Move an existing user between sites |
| `users:deactivate` | Deactivate a user with no active site membership |
| `classifications:read` | Read classification settings and definitions |
| `classifications:write` | Change settings and create or update definitions |

Platform Manager creates and disables clients and selects scopes on the **API** page. System-level Platform Manager accounts are never exposed through the user resources.

## Operations

### Sites

| Method | Path | Scope |
| --- | --- | --- |
| `GET` | `/sites` | `sites:read` |
| `GET` | `/sites/{siteId}` | `sites:read` |
| `GET` | `/site-placement-options` | `sites:read` |
| `POST` | `/sites` | `sites:write` |
| `PUT` | `/sites/{siteId}` | `sites:write` |
| `POST` | `/sites/{siteId}/move` | `sites:move` |
| `POST` | `/sites/{siteId}/deactivate` | `sites:deactivate` |

### Users

| Method | Path | Scope |
| --- | --- | --- |
| `GET` | `/users` | `users:read` |
| `GET` | `/users/{personId}` | `users:read` |
| `POST` | `/users/{personId}/assign` | `users:assign` |
| `POST` | `/users/{personId}/move` | `users:move` |
| `POST` | `/users/{personId}/deactivate` | `users:deactivate` |

### Classifications

| Method | Path | Scope |
| --- | --- | --- |
| `GET` | `/classifications` | `classifications:read` |
| `PUT` | `/classifications/settings` | `classifications:write` |
| `POST` | `/classifications` | `classifications:write` |
| `PUT` | `/classifications/{classificationId}` | `classifications:write` |

Hard deletion is intentionally unavailable. Deactivation preserves identities, historical references, task chains, reports, and auditability.

## Site contract

### Resource

```json
{
  "id": "11111111-1111-1111-1111-111111111111",
  "name": "North Operations",
  "isActive": true,
  "parentOrganizationUnitId": null,
  "parentSiteId": null,
  "overviewDesign": "classic",
  "version": 3
}
```

`overviewDesign` is `classic` or `minimal`. `parentOrganizationUnitId` identifies the concrete organizational attachment point. `parentSiteId` is derived for hierarchy display. `version` is represented by the resource's `ETag`.

### List and read

```http
GET /api/v1/administration/sites?limit=50&search=north
Authorization: Bearer {apiToken}
```

`limit` defaults to 50 and accepts 1–100. `search` is a case-insensitive substring search. Results are alphabetically sorted and returned as `{ "items": [...] }`.

Reading one site returns an `ETag`, for example `ETag: "3"`. Preserve the complete value, including quotes, for a later update.

`GET /site-placement-options` returns active organizational attachment points:

```json
{
  "items": [
    {
      "id": "22222222-2222-2222-2222-222222222222",
      "siteId": "11111111-1111-1111-1111-111111111111",
      "siteName": "Parent Site",
      "name": "Parent Site",
      "isSiteRoot": true
    }
  ]
}
```

Use the returned `id` as `parentOrganizationUnitId`. The operation does not expose members or operational content.

### Create

Creation requires an `Idempotency-Key` of 8–128 characters:

```http
POST /api/v1/administration/sites
Authorization: Bearer {apiToken}
Idempotency-Key: customer-system-20260921-001
Content-Type: application/json

{"name":"North Operations","overviewDesign":"classic"}
```

The response is `201 Created` with `Location`, `ETag`, and the site resource. Omitting `overviewDesign` selects `classic`. A new site receives its hidden site root and the system-defined request type.

The machine administration API requires an active Enterprise entitlement. The shared site-capacity policy is nevertheless applied to this endpoint and the Platform Manager UI: Community permits up to three active sites, including child sites. Existing sites are never disabled by a license downgrade. Attempts to add a fourth active site return `409` with `community_site_limit`.

The same key and identical body return the original result without creating a duplicate. Reusing the key with different content returns `409`. Idempotency records are retained for at least seven days and cleaned daily.

### Edit, move, and deactivate

These operations require the latest ETag in `If-Match`. A missing or malformed precondition returns `428`; a stale version returns `409`.

```http
PUT /api/v1/administration/sites/{siteId}
Authorization: Bearer {apiToken}
If-Match: "3"
Content-Type: application/json

{"name":"Northern Operations","overviewDesign":"minimal"}
```

Editing changes neither placement nor active status.

```http
POST /api/v1/administration/sites/{siteId}/move
Authorization: Bearer {apiToken}
If-Match: "4"
Content-Type: application/json

{"parentOrganizationUnitId":"22222222-2222-2222-2222-222222222222"}
```

Use `null` to make the site an independent top-level site. Inactive or invalid targets, self-placement, descendants, and cycles are rejected. Moving changes future routing; existing task and reporting chains keep their recorded route.

```http
POST /api/v1/administration/sites/{siteId}/deactivate
Authorization: Bearer {apiToken}
If-Match: "5"
```

Deactivation returns `204 No Content` and is rejected while active child sites exist. It releases active memberships, Site Manager and role assignments, current placements, and claimed workflow responsibility. People, tasks, reports, and historical references remain. Unassigned people then become available to Platform Manager for reassignment. Reactivation and hard deletion are not part of `v1`.

## User contract

The API exposes display name, email, active local usernames with last sign-in, external identity provider type, and active site memberships. It never exposes password hashes, MFA secrets, WebAuthn credentials, recovery data, or external subject identifiers.

Search supports names, email addresses, local usernames, identity-provider type, and site membership:

```http
GET /api/v1/administration/users?search=alex&siteId={siteId}&page=1&pageSize=50
Authorization: Bearer {apiToken}
```

`search` and site search values are limited to 200 characters. `page` accepts 1–1,000,000 and `pageSize` accepts 1–100. Invalid limits return `400` before a database query is executed.

Every user mutation requires a unique `Idempotency-Key`:

```json
{"siteId":"11111111-1111-1111-1111-111111111111"}
```

Use this body with `/users/{personId}/assign` for a person without an active site.

```json
{
  "sourceSiteId":"11111111-1111-1111-1111-111111111111",
  "targetSiteId":"33333333-3333-3333-3333-333333333333"
}
```

Use this body with `/users/{personId}/move`. Moving removes the source site's unit placement, local roles, and Site Manager assignment, and releases claimed planning and execution work. Historical attribution remains unchanged.

`/users/{personId}/deactivate` has no request body and requires the person to have no active site membership. It disables active sign-in and identity links while preserving all historical references.

## Classification contract

Classifications form one global platform register, not a per-site list. Deactivation removes a definition from new selections but does not alter stored values on existing tasks or reports.

```http
GET /api/v1/administration/classifications
Authorization: Bearer {apiToken}
```

```json
{
  "enabled": true,
  "items": [
    {
      "id": "44444444-4444-4444-4444-444444444444",
      "name": "RESTRICTED",
      "abbreviation": "R",
      "sortOrder": 10,
      "isActive": true
    }
  ]
}
```

Global enablement uses `PUT /classifications/settings` with `{ "enabled": true }`. Create and update bodies use:

```json
{"name":"RESTRICTED","abbreviation":"R","sortOrder":10,"isActive":true}
```

Names must contain 2–100 characters, abbreviations 1–12 characters, and sort order must be 0–100000. Abbreviations are normalized to uppercase and must be unique.

## Errors and auditing

In addition to the [shared error contract](API.md#error-format), stable administration codes include:

| Status | Codes or typical cause |
| --- | --- |
| `400` | Invalid fields or `invalid_idempotency_key` |
| `401` | Missing, invalid, expired, or disabled client |
| `403` | Required scope is missing |
| `404` | Resource or placement target does not exist |
| `409` | `idempotency_key_reused`, `site_name_conflict`, `community_site_limit`, `version_conflict`, `site_already_inactive`, `active_child_sites`, or invalid state |
| `428` | `if_match_required` or malformed `If-Match` |
| `429` | Authentication or endpoint rate limit reached |

Every mutation writes an atomic platform audit event containing the machine identity, operation, affected resource, correlation ID, and timestamp. Platform audit displays the actor as `API: <client name>`. Secrets and complete request bodies are not recorded.

Production verification must cover every scope, negative authorization, idempotent retries, concurrent updates, hierarchy-cycle prevention, moves with active work, deactivation, pagination, rate limiting, and isolation from operational endpoints.
