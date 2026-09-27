# Isolated federation cancellation — 2026-09-25

## Scope

`assignment.cancelled` is a test-only signed message on an already acknowledged work link. The sender retains its work item while cancellation is queued; it changes to `cancelled` only after a verified receiver receipt. The receiver moves the corresponding task to `request_cancelled` and keeps it for leader acknowledgement. The reason is bounded to 2–2,000 characters; unexpected payload fields are rejected. No ordinary cancellation UI or production route is enabled.

## Verification

| Check | Result | Evidence |
| --- | --- | --- |
| API build | Pass | `dotnet build apps/api/Fylkren.Api.csproj --no-restore -v:q`: zero warnings/errors |
| Protocol contract | Pass | `dotnet run --project tools/federation-protocol-check/FederationProtocolCheck.csproj`: 92 assertions, including counterpart, origin, extra-field and signature checks |
| Two independent instances over HTTPS | Pass | `node tools/run-federation-pair.mjs`: `federationPair: passed`, `cancellationAcknowledged: true`, `cancelledRecipientRetained: true` |
| New-work grant revoked | Pass | The existing assignment was cancelled after the sender's grant for **new** work was suspended; peer authentication and exact work correlation remained required |
| Transport retry | Pass | Re-delivery of the same message produced one inbound receipt and did not remove or duplicate the receiving task |
| Existing regression chain | Pass | Signed assignment, coarse progress, official answer, catalog/grant checks and populated-schema upgrade also passed in the same run |

The test runner removed its disposable containers and volumes. This is not federation release acceptance. Real user-action integration, site-level notification, leader acknowledgement across instances, race/failure recovery controls, report archives and security review remain open.
