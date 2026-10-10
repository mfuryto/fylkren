# Isolated federation coarse-progress return — 2026-09-25

## Scope

The new `assignment.progress` producer and receiver exist only in `FederationTest`. Ordinary installations still have no federated work routes or remote recipient selection. The test-only producer emits fixed external phases with sequence numbers from an acknowledged incoming work item. The signed receiver updates only the matching outgoing work link after checking peer identity, site pair, original assignment correlation, nonce and message identity. Internal work content is not sent.

## Verification

| Check | Result | Evidence |
| --- | --- | --- |
| API build | Pass | `dotnet build apps/api/Fylkren.Api.csproj --no-restore -v:q`: zero warnings and errors |
| Protocol contract | Pass | `dotnet run --project tools/federation-protocol-check/FederationProtocolCheck.csproj`: 87 assertions, including extra-field rejection and signed-payload mutation |
| Two independent instances over HTTPS | Pass | `node tools/run-federation-pair.mjs`: `federationPair: passed`, `coarseProgressReturned: true` |
| Status ordering and duplicate transport | Pass | `under_review` then `assigned` reached the origin with sequences 1 and 2; retry of the first message did not revert status and created no second inbound receipt |
| Terminal official answer | Pass | The existing official-answer return succeeded after progress and the origin's coarse status became `answered` |
| Existing data migration | Pass | Disposable populated database upgraded through the new migration without losing existing site/license records |

The test containers, volumes and temporary certificates were removed by the runner. No customer installation was updated. This is not production federation acceptance. Cancellation, real workflow transition emission, normal UI visibility, report archives on both sides, moving sites with active work and security review remain open.
