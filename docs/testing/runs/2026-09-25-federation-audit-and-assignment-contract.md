# Federation audit provenance and initial assignment contract — 2026-09-25

## Scope

Prepare the work-message receiver without enabling operational remote recipients or accepting remote assignments yet. Changes add a distinct federated audit actor, a safe migration and a bounded initial assignment payload decoder. No work-message endpoint, outbound worker or UI sender is registered.

## Checks

| Check | Result | Evidence |
| --- | --- | --- |
| API compiles after nullable audit actor migration | Pass | `dotnet build apps/api/Fylkren.Api.csproj --no-restore`: 0 warnings, 0 errors |
| Signed federation, assignment and receipt contract assertions | Pass | `dotnet run --project tools/federation-protocol-check/FederationProtocolCheck.csproj --no-restore`: 68 assertions |
| Remote actor remains separate from local person/platform manager | Pass | Protocol assertions for audit factory and snapshot; database constraint in migration |
| Initial assignment cannot claim another origin or existing counterpart | Pass | Decoder assertions reject mismatched origin and non-null counterpart |
| Unknown identity field and invalid priority rejected | Pass | Strict JSON decoder assertions |
| Two-instance HTTPS deployment and new database migrations | Pass | `node tools/run-federation-pair.mjs`: both isolated API/database instances healthy; audit actor and inbound receipt schema present |
| Site-manager audit displays remote site without local-person impersonation | Pass | Synthetic federated audit event read via `/api/site-audit/sites/{siteId}`; mixed local/remote actor rejected by database constraint |
| Mutual grant, revocation, replay defense and populated upgrade | Pass | Pair test passed; `routable: false`; synthetic containers and volumes removed |

The first rerun found that the **test harness**, not the application migration, forgot to drop the new receipt table when simulating a pre-federation database. The harness was corrected and the complete pair test passed on rerun.

## Still required before delivery

- Authenticated receive endpoint with current inbound grant check, durable idempotency, replay rejection and signed acknowledgement.
- Transactional local work-item creation, work link, audit event and notification.
- Outbound queue processor with authorization recheck, retry/status and official response/cancellation flow.
- Two-database end-to-end verification covering source/destination isolation, duplicates, revocation, peer outage, result and report return.

The `routable` flag remains false and remote sites remain absent from normal recipient search.
