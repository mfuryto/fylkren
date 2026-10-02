# Report API

Machine report access uses the Enterprise `machine-api` entitlement in addition to client scope and exact site/work-level grants. Loss of entitlement stops machine API reads but does not delete reports or prevent authorized users from viewing or exporting them in the regular application. See [edition entitlements](../architecture/EDITION_ENTITLEMENTS.md).

The report API is a versioned, read-only integration interface for approved final reports. It does not expose planning, execution steps, internal comments, task history, audit events, incomplete reports, or unapproved reports.

Base path: `/api/v1/reports`

Shared authentication, errors, rate limits, and versioning follow the [public API conventions](API.md).

## Access model

Access requires both controls:

1. an active machine client with `reports:read`;
2. an explicit Platform Manager grant for exactly one site and one work level.

Grants do not inherit to a parent site, child site, superior unit, subordinate unit, or sibling unit. `organizationUnitId: null` represents the site's top level. Every other level needs a separate grant.

Classified reports are excluded by default. Platform Manager must enable `includeClassified` on the exact grant. Without it, classified reports are omitted from lists and detail requests return `404`. The option does not broaden the site, level, or content boundary.

Platform Manager administers the technical client and its grants but does not gain report access in the personal browser session. Report content is available only to the granted machine client through this API.

## Configure access

1. Open **API** as Platform Manager.
2. Create a client with `reports:read` and store its one-time secret safely.
3. Under report access, choose the client, site, exact work level, and whether classified reports are allowed.
4. Call the API with the assigned `siteId` and, for a non-top-level grant, its `unitId`.
5. Remove the grant when no longer needed; new access stops immediately.

## List reports

```http
GET /api/v1/reports?siteId={siteId}&unitId={unitId}&year={year}&search={text}&page={page}&pageSize={pageSize}
Authorization: Bearer {apiToken}
Accept: application/json
```

| Parameter | Required | Rules |
| --- | --- | --- |
| `siteId` | Yes | Must match the exact site grant |
| `unitId` | No | Omit for site top level; otherwise must match the exact level grant |
| `year` | No | Approval year |
| `search` | No | Searches local reference, external origin reference, task title and final-report content; maximum 200 characters |
| `page` | No | 1–1,000,000; default 1 |
| `pageSize` | No | 1–100; default 50 |

Invalid bounds return `400`; they are not silently rewritten. Results contain only completed work with a final report and recorded approval, ordered by newest approval first.

```json
{
  "items": [
    {
      "id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      "referenceCode": "INS-000123",
      "originReference": "REQ-004291",
      "title": "Emergency power inspection",
      "siteId": "11111111-1111-1111-1111-111111111111",
      "siteName": "North Operations",
      "organizationUnitId": null,
      "organizationPath": [],
      "finalReportClassification": null,
      "reportCreatedAt": "2026-09-13T10:15:00Z",
      "workReceivedAt": "2026-09-10T08:00:00Z",
      "workCompletedAt": "2026-09-13T10:15:00Z",
      "writtenBy": "Alex Example",
      "approvedBy": "Casey Example",
      "finalReportApprovedAt": "2026-09-13T11:00:00Z"
    }
  ],
  "page": 1,
  "pageSize": 50,
  "total": 1,
  "totalPages": 1
}
```

The list contains metadata only.

## Read one report

```http
GET /api/v1/reports/{reportId}
Authorization: Bearer {apiToken}
Accept: application/json
```

The detail response contains the list fields plus `finalReport`:

```json
{
  "id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  "referenceCode": "INS-000123",
  "originReference": "REQ-004291",
  "title": "Emergency power inspection",
  "siteId": "11111111-1111-1111-1111-111111111111",
  "siteName": "North Operations",
  "organizationUnitId": null,
  "organizationPath": [],
  "finalReport": "<h1>Summary</h1><p>The inspection is complete.</p>",
  "finalReportClassification": null,
  "reportCreatedAt": "2026-09-13T10:15:00Z",
  "workReceivedAt": "2026-09-10T08:00:00Z",
  "workCompletedAt": "2026-09-13T10:15:00Z",
  "writtenBy": "Alex Example",
  "approvedBy": "Casey Example",
  "finalReportApprovedAt": "2026-09-13T11:00:00Z"
}
```

`referenceCode` is the permanent local reference assigned by this installation. `originReference` is the signed external reference retained for federated inbound work and is `null` for work without one. Both fields remain attached to the approved report. `finalReport` is stored rich text. Treat it as untrusted data and sanitize it before rendering as HTML.

`organizationPath` contains names from the first internal level through the report's authoring level. It excludes the hidden technical site root and the designated top leadership unit because that unit represents site top level. A top-level report therefore has an empty path. `organizationUnitId` is the stable reference; path names are display data.

## Errors and information hiding

| Status | Meaning |
| --- | --- |
| `400` | A query parameter is invalid |
| `401` | The client credential is missing, malformed, unknown, expired, or disabled |
| `403` | `reports:read` is missing, or a list request targets a level without a grant |
| `404` | The report is unknown, incomplete, unapproved, outside the exact grant, or classified without permission |
| `429` | A rate limit was reached; retry with controlled backoff |

The detail endpoint intentionally returns the same `404` for missing and inaccessible reports.

## Audit and personal data

Creating, changing, or removing a report grant creates a platform audit event for the affected site. These technical events are excluded from Site Manager audit. List and detail requests create machine audit records containing the client, site, grant or report ID, correlation ID, and timestamp. The Bearer token, search text, and report body are not logged.

Responses can contain the names of report authors and approvers. The consuming system must protect, retain, and delete these data according to the same policy as the report. Disabling a site immediately prevents further report access.

## Production verification

Test at least:

- the correct level and each wrong-level direction in the same site;
- another site, including parent and child sites;
- complete, incomplete, approved, and unapproved reports;
- classified reports with and without explicit permission;
- disabled and expired clients and missing scopes;
- pagination boundaries and rate limiting;
- audit records without secrets, search text, or report content.
