# Webhooks and domain events

Creating subscriptions and delivering webhooks require the Enterprise `webhooks` entitlement. Without it, existing subscriptions, queued events and delivery history remain stored and readable to Platform Manager, but new deliveries pause. See [edition entitlements](../architecture/EDITION_ENTITLEMENTS.md).

Fylkren records important domain actions as durable domain events. Domain events are separate from the technical audit log: the audit log explains administrative activity, while domain events form the stable integration contract.

## Envelope version 1

```json
{
  "id": "event UUID",
  "type": "task.created",
  "schemaVersion": 1,
  "timestamp": "2026-09-22T12:00:00Z",
  "siteId": "tenant UUID",
  "actorId": "person UUID or null",
  "resource": { "type": "task", "id": "resource UUID" },
  "data": {}
}
```

The event ID is stable and must be used by receivers for idempotency. Fields are only added compatibly within a schema version. Breaking changes require a new schema version. Event data never crosses the site boundary of the subscription.

## Supported catalogue

Version 1 supports `task.created`, `task.completed`, `assignment.created`, `plan.approved`, `execution.started`, and `decision.recorded`. The machine-readable catalogue is available to Platform Manager at `GET /api/platform/webhooks/catalog`.

## Delivery and retries

Delivery is asynchronous and cannot roll back or block the originating user action. A successful HTTP 2xx response completes delivery. Other responses and network failures are retried after approximately 1, 5, 30, 120 and 720 minutes, with a final attempt after 24 hours. Each attempt and its concrete error are retained. Requests time out after 10 seconds and redirects are not followed.

## Signature verification

The receiver gets a signing secret once. Requests include `X-Fylkren-Event-Id`, `X-Fylkren-Event-Type`, `X-Fylkren-Timestamp`, and `X-Fylkren-Signature: v1=<hex digest>`.

Calculate HMAC-SHA256 with the UTF-8 secret over `<timestamp>.<raw request body>`, compare the hexadecimal digest in constant time, reject stale timestamps, and deduplicate by event ID. Never parse and re-serialize the body before signature verification.

## Administration

Platform Manager configures subscriptions per site under **API → Webhooks**. HTTPS is mandatory. The view provides subscription state and delivery status/history. Deactivation stops new deliveries but preserves history. No third-party-specific integration is part of this foundation.
