# Federated cancellation after a receiving-site move — 2026-09-25

## Run context

- Test tool: `node tools/run-federation-pair.mjs` with the cancellation-after-move assertions in `assertReplyAfterDestinationSiteMove`.
- Environment: disposable `FederationTest` pair with two independently identified API installations, separate PostgreSQL databases and a TLS proxy. All sites, users and work items are synthetic.
- Fixture reset: the runner creates fresh volumes and removes its containers and volumes when finished. Raw HTTP and SQL logs are not retained.

## Scenario and controls

Two assignments were delivered to the receiving top-level site. The receiving site was then moved under a parent, which suspended its publication and grant for new work. The origin synced that catalog change. One existing assignment received an official answer; the other was cancelled by its origin while the receiving site was still a child. Neither action should depend on permission to send a **new** assignment. The receiving site was later restored to top level, but publication and grants were reactivated only by explicit administrative actions.

| Control | Expected result | Observed result | Result / evidence |
| --- | --- | --- | --- |
| New work to moved site | Rejected without an outbound record | HTTP 409; outbound message count unchanged | Pass — `assertReplyAfterDestinationSiteMove` |
| Existing answer | Signed official response returned to original work link | Answer delivered, accepted and archived at both sites | Pass — `assertQueuedOfficialAnswer` |
| Existing cancellation | Sender remains open until signed acknowledgement; receiver retains a cancelled work item | Sender changed from `registered` to `cancelled` only after delivery; receiver changed to `request_cancelled` and retained one work item | Pass — `assertQueuedCancellation` |
| Replay | Same cancellation cannot produce another receipt or work item | Retry acknowledged; one inbound receipt remained | Pass — cancellation retry assertions |
| Restoration | Returning to root does not silently reopen routing | No active publication until explicit republish and reciprocal grant restoration | Pass — publication and grant assertions |
| Full regression | Earlier isolated scenarios remain valid | `federationPair: passed`, `cancellationAfterDestinationMove: true`, `routable: false` | Pass — full pair runner |

`node --check tools/run-federation-pair.mjs` and `git diff --check` passed. This test sends cancellation **after** a completed site move; it does not test a cancellation concurrent with the move or the receiving leader's normal UI acknowledgement. It does not establish production federation readiness, performance, security acceptance, notifications or real-workflow integration.
