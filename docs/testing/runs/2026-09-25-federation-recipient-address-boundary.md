# Instance-qualified request recipient boundary — 2026-09-25

## Run context

- Test tools: `dotnet build apps/api/Fylkren.Api.csproj --no-restore -v:q`, `pnpm --filter @fylkren/web typecheck`, `pnpm --filter @fylkren/web test`, `node --check` on changed E2E scripts, and `pnpm test:e2e:local`.
- Application base commit: `88950f3`; these address-boundary changes were uncommitted during the run.
- Environment: local API/web build and a disposable Community/Enterprise API integration Compose project with a fresh database and synthetic sites, leaders and tasks. The E2E runner removed its containers and volumes. Raw HTTP/SQL logs were not retained.

## Change under test

Recipient search already returns `(instanceId, id)` for local site and unit choices. Task creation, side-anmodning and planning-anmodning now retain that instance ID and include `targetInstanceId` in their write requests. Their shared API boundary accepts the local instance ID, preserves omitted IDs for existing local clients, and rejects an explicitly different instance ID before local site lookup or work-item creation. No remote recipient is returned by the normal search and no production federated work route is enabled.

| Control | Expected | Observed | Result / evidence |
| --- | --- | --- | --- |
| API compilation | New shared rejection policy and optional request field compile | Zero warnings and zero errors | Pass — API build |
| Frontend typing | Three request forms carry the selected instance ID through submission | Typecheck passed | Pass — web typecheck |
| Frontend regression | Existing web behavior remains covered | 25 test files and 78 tests passed | Pass — web test suite |
| Primary task request | Foreign instance ID must not be treated as a local site ID | HTTP 409, `federated_recipient_not_routable` | Pass — `tools/test-e2e-local.mjs` |
| Side request | Foreign instance ID must be rejected before a local side branch is created | HTTP 409 with the same error code; qualified local request then succeeded | Pass — `tools/e2e/combined-branches.mjs` |
| Planning request | Foreign instance ID must be rejected before storing a local plan request | HTTP 409 with the same error code; qualified local plan request then succeeded | Pass — `tools/e2e/combined-branches.mjs` |
| Existing local workflows | Legacy local requests and qualified local requests still work | E2E reported `crossSiteRequestResponse`, `crossSiteRequestCancellation`, `combinedBranches`, `parentChildReporting` and `threeSiteReporting` as passed | Pass — disposable E2E suite |
| Cleanup | No test data remains in the ordinary installation | Disposable containers and volumes removed | Pass — runner teardown |

The first `node --check` invocation found a test-variable name collision (`wrongInstance` was already declared for an earlier license test). The test variable was renamed before the E2E run; the corrected syntax check and full run passed. No application defect was observed from that false start. Manual UI, real inter-instance work routing, notifications over a real SMTP server, performance, print/PDF and security acceptance were not tested here. The normal recipient search still excludes remote sites by design.
