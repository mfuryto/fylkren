# Isolated federation outbound queue test — 2026-09-25

## Scope and boundary

The synthetic outbound producer and delivery worker are registered only in the `FederationTest` environment. They are not available in an ordinary installation, and remote sites are still not normal task recipients (`routable: false`). The test producer creates a local work item, outbound row, origin link, domain event and audit event in one transaction. The worker claims due rows with a database-backed lease, rechecks local permission and entitlement, signs each attempt with a fresh nonce and verifies the peer's signed receipt before marking delivery complete.

## Verification

| Test | Result | Evidence |
| --- | --- | --- |
| API build | Pass | `dotnet build apps/api/Fylkren.Api.csproj --no-restore`: 0 warnings/errors |
| Two independent databases and HTTPS peer transport | Pass | `node tools/run-federation-pair.mjs` |
| Atomic local work/outbox/link creation | Pass | Database assertions for the same work and message IDs |
| Destination without a current grant | Pass | Test endpoint returned 409 and outbound-row count stayed unchanged |
| Asynchronous delivery and signed receipt verification | Pass | Sender reached `delivered` and stored receiver's counterpart ID; receiver stored one work item and one inbound receipt |
| Lost-acknowledgement-style retry | Pass | Forced retry of the same message returned the same counterpart and created no second receiver item |
| Existing federation defenses and populated-schema upgrade | Pass | Pair test reports `federationPair: passed`, `populatedSchemaUpgrade: true` and `routable: false` |

The runner uses synthetic data and removes its test containers, networks and volumes afterward.

## Remaining release gates

- Connect real user work actions to the transactional outbox and expose bounded delivery status, retries and failure handling to authorized operators.
- Connect the synthetic official approved answer return to the normal workflow; implement coarse external status and cancellation without exposing internal subordinate work across sites.
- Test revocation during queued delivery, sender process crashes, multiple sender replicas, out-of-order responses, site moves, mixed versions and entitlement loss.
- Complete security review and public protocol documentation before removing the `FederationTest` guard.
