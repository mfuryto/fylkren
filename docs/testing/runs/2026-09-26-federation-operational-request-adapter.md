# Federated operational request adapter — 2026-09-26

## Run context

- Test tools: `dotnet build apps/api/Fylkren.Api.csproj --no-restore -v:q`, `node --check tools/run-federation-pair.mjs`, `git diff --check`, `pnpm test:e2e:local`, and `node tools/run-federation-pair.mjs`.
- Application base commit: `eb87884`; the adapter and test changes were uncommitted during the run.
- Environment: two disposable Enterprise API installations in `FederationTest`, separate PostgreSQL databases, a shared HTTPS test gateway, a second receiver API replica, synthetic leaders, sites, peer keys, catalogs and reciprocal grants. The runner removed all containers, networks and volumes. Raw HTTP/SQL logs were not retained.

## Change under test

The isolated federation test environment now exposes authorized remote catalog entries through the ordinary request-recipient search and routes the ordinary primary `Anmodning` creation command through the transactional federation outbox. Ordinary environments still omit remote recipients and reject foreign instance addresses. Side-request, planned-request and ordinary return actions remain disconnected.

| Control | Expected | Observed | Result / evidence |
| --- | --- | --- | --- |
| API compilation | Recipient query, request adapter and projection compile | Zero warnings and zero errors | Pass — API build |
| Test syntax and patch hygiene | Pair runner parses and changed files contain no whitespace errors | Both checks exited successfully | Pass — `node --check`, `git diff --check` |
| Unauthorized discovery | A remote catalog entry without an active outbound grant is absent | Recipient search omitted the remote site before the grant and after grant suspension | Pass — pair runner |
| Authorized discovery | An active peer, publication, remote snapshot and outbound grant expose the qualified remote site in `FederationTest` | Search returned the exact remote `(instanceId, siteId)` | Pass — pair runner |
| Ordinary request creation | The normal site-leader request command commits local work, outbox row and outgoing link together | HTTP 201; all three records existed with the same origin work ID | Pass — pair runner and database assertions |
| Signed delivery | The test-only worker delivers the ordinary request and stores the signed acknowledgement | Outbox reached `delivered`; sender stored the receiver counterpart; receiver stored one item and receipt | Pass — pair runner |
| Operational projection | Sender overview identifies an external outgoing request and its current delivery state | Remote site snapshot shown; `isOutgoingRequest` and `requestRecipientIsExternal` true; status `received` | Pass — pair runner |
| Entitlement loss | Removing the Enterprise license hides the remote recipient and rejects a qualified write without leaving work or outbox state | Search omitted the remote site; create returned HTTP 403; outbox count was unchanged; license was then restored | Pass — pair runner |
| Existing lifecycle regression | Progress, official answer, report archives, cancellation, retries, site moves and revocation still work | All prior pair scenarios passed | Pass — pair runner summary |
| Ordinary installation regression | Community/Enterprise local workflows and the foreign-address rejection remain unchanged | Full disposable edition suite passed, including cross-site response/cancellation, combined branches, planning and federation candidates | Pass — `pnpm test:e2e:local` |
| Upgrade and cleanup | Populated pre-federation schema upgrades and disposable resources are removed | Upgrade passed; Compose removed containers, network and volumes | Pass — runner teardown |

The first local build attempt could not write the default `.NET` CLI sentinel under the restricted home directory. A writable temporary CLI home was then used. Its package cache was empty, so dependencies were restored from NuGet after explicit network approval; the clean build passed. The first pair-run attempt lacked Docker socket permission. A later full rerun reached a pre-existing timing-sensitive cancellation assertion after the new entitlement control had passed: the signed cancellation receipt completed before the test sampled its intended pre-acknowledgement state. Logs showed HTTP 200 and the atomic `cancelled`/`delivered` result. The assertion was corrected to accept the completed state only when the matching message is already `delivered`. The following run exposed another wall-clock dependency: a transient attempt after restoring a moved destination entered the normal one-minute backoff while the test waited only 30 seconds. The delivery helper now advances retry time in this isolated suite and reports the retained error code, matching the runner's existing controlled-retry scenarios. A clean rerun then passed. These were environment/test-harness failures, not application failures.

Manual browser UI, ordinary-environment remote routing, side/planning request routing, ordinary answer/cancellation actions, SMTP delivery, performance, print/PDF and security acceptance were not tested. Federated work delivery remains unavailable outside `FederationTest`.
