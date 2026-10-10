# Isolated federation official-answer return — 2026-09-25

## Scope

Only `FederationTest` registers the synthetic top-level answer producer, outbound worker and signed answer receiver. Ordinary installations do not expose these routes and do not offer federated task recipients. The answer payload contains only `officialReport` and `approvedAt`; plans, subordinate work, personnel and technical audit are never included. The originating site stores the immutable official answer against its acknowledged outgoing work link, separate from its own work-item status, so a local leader can review it before any future completion action. The received answer and peer actor are audited.

The recipient authorizes a return against an existing acknowledged `(origin instance, origin site, origin work item, counterpart work item, peer, site)` link and requires its correlation/causation ID to identify the original delivered assignment message. It does not require a currently active grant for **new** work, allowing an in-flight official answer to return after that grant has been revoked. The peer must still be active and cryptographically authenticated. Retries of the same message are idempotent; a different second official answer cannot overwrite the first.

## Verification

| Test | Result | Evidence |
| --- | --- | --- |
| API build | Pass | `dotnet build apps/api/Fylkren.Api.csproj --no-restore`: 0 warnings/errors |
| Two-instance signed answer and acknowledgement | Pass | `node tools/run-federation-pair.mjs` reports `officialAnswerReturned: true` |
| No internal subordinate data in payload | Pass | Exact two-field payload assertion and 80 protocol checks |
| New-work grant revoked after task delivery | Pass | Return reached origin through existing link; `answerAfterGrantRevocation: true` |
| Duplicate retry and conflicting second answer | Pass | One inbound receipt; immutable first answer |
| Populated database upgrade | Pass | Pair test reports `populatedSchemaUpgrade: true` with the new migration |

## Not released

This synthetic test does not connect real task completion, progress statuses or sender-side acceptance to the normal UI. The official answer is stored on the origin's federation link, **not yet in both sites' normal report archives**; the existing requirement for a retained report on each side with the correct site header remains a release gate. Classification/document-transfer policy, cancellation, full authorization and outage/move/mixed-version regression testing remain required before production federation can be enabled.
