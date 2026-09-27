# Isolated federation official-answer archives — 2026-09-25

## Scope

The receiver's synthetic approved, completed top-level work item appears in its own site report archive. The sender first stores the signed official answer on the acknowledged outgoing work link. Only an authenticated leader of the sender's site may accept that answer in the isolated `FederationTest` environment. Acceptance creates a formal approval, completes the sender work item and makes its report visible in the sender's existing site report archive. The receiver's site name is captured on arrival and displayed as the official report header, independent of later renames. Neither side imports subordinate reports or internal plans across the instance boundary.

The existing work-item report column is limited to 20,000 characters, so the test-only official-answer contract is bounded to the same maximum. Longer answers must not be silently truncated or accepted only in the transport layer.

## Verification

| Check | Result | Evidence |
| --- | --- | --- |
| API build and protocol | Pass | `dotnet build apps/api/Fylkren.Api.csproj --no-restore -v:q`: zero warnings/errors; protocol check: 92 assertions |
| Two independent instances | Pass | `node tools/run-federation-pair.mjs`: `reportsArchivedAtBothSites: true`, `remoteReportHeaderStable: true` |
| Receiver archive | Pass | Receiver's authorized site leader read the approved response through the ordinary `/api/work/sites/{siteId}/reports` query |
| Sender acceptance | Pass | Before acceptance the response was absent from the sender's report archive; after a sender-site leader accepted it, the same content appeared there with receiver-site header |
| Historical timestamps | Pass | Sender preserved the receiver's official approval date as report origin and recorded its own later acceptance as work completion |
| Duplicate acceptance | Pass | A second approval attempt returned HTTP 409 |
| Site rename | Pass | The sender's archived header retained the original receiver-site name after the receiver site was renamed and its catalog synced |
| Existing federation chain | Pass | Signed delivery, coarse progress, official response, cancellation, grant checks and populated-schema migration also passed in the same run |

The runner removed its disposable containers, volumes and temporary certificates. No customer installation was updated. Normal user workflows, attachments, classification policy, release-level authorization review and federation security verification remain open; this is not production acceptance.
