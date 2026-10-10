# Federation work-contract preparation — 2026-09-24

## Scope

This change prepares, but does not activate, federated work delivery. It adds a versioned signed message envelope, consolidates the inbound site-grant authorization predicate, and permits externally originated work items to record a sender-site snapshot without inventing a local user. There is no work-message endpoint, outbound producer, background sender or remote recipient selector in this change. `routable` remains `false`.

## Verified behavior

| Check | Result |
| --- | --- |
| API build | Passed with zero warnings and errors. |
| Signed envelope protocol | 57 assertions passed, including payload, destination, origin, counterpart, correlation, nonce and message-ID tamper rejection; type syntax and UTF-8 payload limit enforced. |
| Two independent instances | Passed over isolated HTTPS with separate databases and signing keys. Mutual probe, catalog, reciprocal grant, revocation, replay, stale catalog and upgrade assertions passed. |
| Database migration | Fresh two-instance startup succeeded; test explicitly confirmed nullable external creator column and sender-site check constraint. Existing local tasks and federation state survived the simulated schema upgrade. |
| Existing operational flows | Passed in the isolated edition E2E run: bootstrap, Community/Enterprise transitions, local and cross-site task/report chains, recursive workload, decisions/risks, API authorization, webhooks, portable export and federation-candidate checks. This is regression coverage, not a federated work-delivery test. |

The new nullable creator is only for a future receive adapter. Locally created work still references a local person. If the creator is absent, the database requires a nonblank sender-site snapshot; queue, detail, planning, execution, report and export projections handle that provenance without adding a remote person to local personnel.

## Deferred gates

Before remote sites are routable: define the exact supported assignment payload, transactional outbound enqueue, authenticated and idempotent inbound handling, acknowledgement, bounded retries, status/cancellation/official-report round trip, notifications, classification/document policy and mixed-version behavior. Test these with two independent installations and active work while a site moves or a grant is revoked. No current test result should be read as evidence that those flows already work.
