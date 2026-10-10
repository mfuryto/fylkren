# Isolated federated-work receive test — 2026-09-25

## Scope and release gate

The signed `assignment.created` receiver is registered **only** when `ASPNETCORE_ENVIRONMENT=FederationTest`. The normal production API does not expose `/api/federation/v1/work`, and remote sites remain absent from normal recipient search (`routable: false`). This is intentionally not a usable federation release: sender-side durable delivery, status, cancellation and official approved report return are still missing.

The receiver requires HTTPS, Enterprise entitlement, an active peer with pinned P-256 key and recorded proof, valid signature and timestamp, a fresh nonce, a current active inbound top-level site grant, and a strict assignment payload. It resolves the official sender-site name from the peer catalog rather than a user-supplied payload field. One transaction persists the receiving site's work item, origin work link, inbound message receipt, nonce, domain event and remote-provenance audit event. A signed receipt binds the message and created counterpart ID. A retry with a new nonce is idempotent; a repeated nonce or altered content is rejected.

## Verification

| Test | Result | Evidence |
| --- | --- | --- |
| API build | Pass | `dotnet build apps/api/Fylkren.Api.csproj --no-restore`: 0 warnings/errors |
| Wire signature and acknowledgement assertions | Pass | `dotnet run --project tools/federation-protocol-check/FederationProtocolCheck.csproj --no-restore`: 72 assertions |
| Synthetic two-instance HTTPS receive and signed acknowledgement | Pass | `node tools/run-federation-pair.mjs`; receiver persisted one local item, origin link, receipt and remote audit actor |
| Same message, fresh nonce | Pass | Returns same local item with signed `duplicate: true` |
| Replayed nonce, altered payload or correlation for existing message ID | Pass | Rejected without another work item |
| Invalid signature, wrong instance/site, concurrent API replicas | Pass | Pair run rejected invalid signatures and cross-site messages; concurrent deliveries to two API replicas created one work item |
| Grant revocation | Pass | Receiver rejects a subsequent retry after inbound grant suspension |

Only synthetic, disposable test data was used. Test containers, networks and volumes are removed by the runner.

## Remaining before production enablement

- Transactional outgoing message creation tied to local work actions and a bounded asynchronous retry worker.
- Signed receipt verification by sender, durable delivery status and operator visibility.
- Coarse external status, cancellation and official approved answer/report return, with correct same-site vs cross-instance information boundaries.
- Authorization and tenant-isolation regression tests for the full forward/return chain, mixed-version handling, outages and site moves.
- Security review of the endpoint and final operator documentation before removing the `FederationTest` guard.
