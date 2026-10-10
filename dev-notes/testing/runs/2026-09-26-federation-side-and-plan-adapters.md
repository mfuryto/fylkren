# Federated side and plan request adapters — 2026-09-26

## Run context

- Test tools: `dotnet build apps/api/Fylkren.Api.csproj --no-restore -v:q`, `node --check tools/run-federation-pair.mjs`, `git diff --check`, `pnpm test:e2e:local`, and `node tools/run-federation-pair.mjs`.
- Application base commit: `e4c10d0`; these adapter, schema and test changes were uncommitted during the run.
- Environment: two disposable Enterprise API installations in `FederationTest`, separate PostgreSQL databases, HTTPS test gateway, receiver replica and synthetic sites/leaders with reciprocal grants. The runners removed their containers, networks and volumes. Raw HTTP/SQL logs were not retained.

## Change under test

The two remaining ordinary request entry points now use qualified remote addresses in the isolated federation environment. A side request commits its tracking item, link and outbound message together. A planned request persists either a local site foreign key or a remote `(instanceId, siteId, name snapshot)` under a database check constraint. Plan approval does not dispatch it; release rechecks the current entitlement and route before creating the tracking item and outbox message.

| Control | Expected | Observed | Result / evidence |
| --- | --- | --- | --- |
| API compilation | Nullable local/qualified remote plan model and both adapters compile | Zero warnings and zero errors | Pass — API build |
| Schema boundary | Exactly one local or remote plan-recipient representation is allowed | Migration added nullable local FK, remote address/name columns, filtered unique indexes and XOR check constraint | Pass — migration and model snapshot |
| Existing-row upgrade | A populated pre-change schema upgrades without losing existing installation data | Pair runner rolled back the plan-recipient columns plus federation tables, restarted the API, and verified the new column and constraint | Pass — populated upgrade scenario |
| Ordinary side request | Qualified remote selection uses the normal side-request command | HTTP 201; tracking item/link/outbox committed; signed delivery acknowledged; projection showed external `received` state | Pass — pair runner |
| Plan draft | Qualified recipient remains a draft with its instance, site and name snapshot | Planning queue returned the exact remote address and name | Pass — pair runner |
| Approval boundary | Formal approval must not dispatch the planned remote request | No matching outbox row existed after approval | Pass — pair runner |
| Plan release | Explicit release rechecks authorization and queues the request | HTTP 204; one tracking item/outbox/link was created and delivered with one receiver receipt | Pass — pair runner |
| Existing federation lifecycle | Return progress, official answer, cancellation, retries, moves, outage recovery and report archives remain intact | Full pair summary passed | Pass — pair runner |
| Ordinary installation regression | Local primary, side and planned requests remain unchanged and foreign addresses remain rejected | Full Community/Enterprise suite passed | Pass — `pnpm test:e2e:local` |
| Cleanup | Disposable test state is removed | Containers, networks and volumes removed | Pass — runner teardown |

The locally installed .NET CLI does not include `dotnet-ef`, so the migration and model snapshot were authored explicitly and then exercised against fresh and reconstructed older schemas. Manual browser UI, ordinary-environment federation, normal user answer/cancellation/progress actions, operator retry controls, SMTP, performance, print/PDF and security acceptance were not tested. Federated work delivery remains unavailable outside `FederationTest`.
