# Public API conventions

This document defines the shared contract for Fylkren's versioned machine APIs. Resource-specific operations are documented in the [administration API](ADMINISTRATION_API.md), [report API](REPORT_API.md), and the outbound [webhook and domain-event contract](WEBHOOKS.md).

## API boundaries

Fylkren is closed by default. Anonymous access is limited to health checks, public configuration and branding needed before sign-in, authentication flows, and first-time Platform Manager bootstrap while no such account exists.

| API | Base path | Purpose |
| --- | --- | --- |
| Administration | `/api/v1/administration` | Manage sites, users, and classifications |
| Reports | `/api/v1/reports` | Read approved final reports within explicit grants |

Routes under paths such as `/api/platform` are internal browser endpoints. They are not supported integration contracts and may change without API-version guarantees.

Formal approval history is exposed to the authorized browser client through `GET /api/approvals/sites/{siteId}/items/{itemId}/versions`. It returns immutable approved snapshots, integrity hashes, statuses and sign-offs for the selected work item. This is an authenticated product endpoint rather than a public machine-integration contract; see [versioning and formal approvals](../architecture/FORMAL_APPROVALS.md).

The authenticated browser reads object or Site activity through `GET /api/activity/sites/{siteId}` with optional `workItemId`, `eventType`, `resourceType`, `from`, `until`, `before`, `beforeId` and `limit` (1–50) parameters. Current owner/work visibility and exact-level learning access are checked before pagination. The response omits domain payloads and activity metadata. Reversible information transitions use `/api/information/sites/{siteId}/work-items/{itemId}` and its `transitions` subroute, with manager authority, CSRF, version and relationship checks. These browser routes are not new machine or federation contracts. See [architecture and traceability](../architecture/EVENT_ACTIVITY_AND_INFORMATION_LIFECYCLE.md).

All responses below `/api` use `Cache-Control: no-store`. Static, content-hashed web assets have a separate cache policy.

## Machine authentication

Platform Manager creates machine clients on the **API** page. A client represents one integration in one environment, never a person. Its secret is displayed once in this form:

```text
api_<key-id>.<secret>
```

Only a salted, versioned PBKDF2 verifier is stored. Existing SHA-256 verifiers upgrade to the current SHA-512 verifier after successful authentication; plaintext machine secrets are never retained. A new client must expire within one year; the interface proposes 90 days. Send the key as a Bearer token:

```http
Authorization: Bearer api_<key-id>.<secret>
Accept: application/json
```

Store keys in the consuming system's secret store. Never put them in source code, logs, issues, or documentation. Interactive cookies, user passwords, bootstrap values, and CSRF tokens are not machine credentials.

Rotate a key by creating a replacement client, switching the integration, verifying it, and then disabling the old client. Secrets cannot be retrieved after creation.

Browser mutations made with an authenticated session require `X-Fylkren-CSRF`. Bearer-authenticated machine APIs do not use browser sessions and do not require this header.

## Least privilege

- Create a separate client for each integration and environment.
- Grant only the scopes the client needs.
- Set the shortest practical expiry date.
- Disable clients immediately when an integration ends or a key may be exposed.
- Treat scope and resource grants as separate controls. For example, `reports:read` does not grant access to any report until Platform Manager assigns an exact site and work level.
- A machine client cannot extend its own scopes or create other machine clients through these APIs.

## Data and HTTP rules

- Request and response bodies use UTF-8 JSON.
- Resource identifiers are standard hyphenated UUID strings.
- Timestamps use ISO 8601 with an offset or UTC.
- Clients must ignore unknown response fields so compatible fields can be added to `v1`.
- Unknown resources normally return `404 Not Found`.
- Missing, invalid, expired, or disabled credentials return `401 Unauthorized`.
- Missing scope or grant normally returns `403 Forbidden`.
- Report details deliberately use `404` when the resource is unknown or inaccessible, to avoid disclosing its existence.
- `429 Too Many Requests` requires bounded exponential backoff and respect for `Retry-After` when present.

Mutations that support retries require `Idempotency-Key`. Reuse the same key only for retries of the same logical operation. Concurrent updates use `ETag` and `If-Match` where specified by the resource contract.

## Error format

Expected API failures use `application/problem+json`. A response can include:

```json
{
  "type": "about:blank",
  "title": "The resource has changed",
  "status": 409,
  "code": "version_conflict",
  "correlationId": "00-0123456789abcdef-0123456789abcdef-00"
}
```

Validation failures also contain an `errors` object keyed by field. Internal exceptions, SQL details, secrets, and authentication material are never returned. Consumers should retain the correlation ID when reporting a failure.

## Rate limiting and credential protection

Limits apply per authenticated machine identity, with stricter limits for mutations. Before expensive secret hashing, Fylkren permits at most 120 authentication attempts per minute and two concurrent verifications for the same key ID and client address. The normal endpoint limits apply after successful authentication.

Clients should record their own correlation ID, timestamp, method, path, result, and retry state. They must not log Bearer tokens, classified content, report bodies, or unnecessary personal data.

## Versioning

`v1` is the compatibility boundary. Additive response fields and new optional capabilities may be introduced without a new major version. Removing a field, changing its meaning, or making an optional field mandatory requires a new major API version.

## Production checklist

Before enabling an integration, verify that:

1. missing or invalid credentials return `401`;
2. missing scopes return `403`;
3. the client sees only its intended resources and exact grants;
4. disabled and expired clients are rejected;
5. tokens and sensitive response bodies do not appear in application or proxy logs;
6. the reverse proxy preserves `Authorization`, `If-Match`, and `Idempotency-Key`;
7. TLS is used outside an explicitly bounded, trusted internal network;
8. retry handling is idempotent and respects `429` responses.

The APIs are included in the planned OWASP ASVS, WSTG, and OWASP API Security Top 10 verification.
