# In-flight federated work across a destination-site move — 2026-09-25

## Run context

- Test tool: `node tools/run-federation-pair.mjs` (test-code change in this run; application base commit `0655ca9`).
- Environment: disposable `FederationTest` Docker pair with distinct instance identities and PostgreSQL databases, a TLS proxy and a second API replica on the receiving database. Synthetic Platform Managers, site leaders, top-level sites, a receiving parent site and an in-flight assignment were created by the runner.
- Fixture reset: fresh containers and volumes; the runner removed them after the run. Raw HTTP/SQL logs were not retained.

## Scenario and observations

The origin's top-level site sent an assignment to the receiving top-level site and obtained a signed delivery receipt. The receiving site was then placed below a newly created parent site. The origin refreshed its catalog and attempted to queue another assignment to that now-child site. The receiving site answered the **existing** assignment with its official top-level report. The origin leader accepted that answer, after which the receiving site was moved back to the root. Publication and both directional grants were restored explicitly for the remaining regression scenarios.

| Control | Expected | Observed | Result / assertion |
| --- | --- | --- | --- |
| Destination hierarchy change | Receiving site becomes a child | Parent-unit relationship was accepted by the site API | Pass — `assertReplyAfterDestinationSiteMove` |
| New-work authorization | Child site loses publication and inbound permission | No active publication or inbound grant remained; refreshed origin catalog marked it inactive | Pass — database and catalog assertions |
| New assignment | Origin cannot send new work to that child site | Synthetic outbound producer returned HTTP 409 without adding an outbound message | Pass — producer status and database-count assertions |
| Existing assignment | Official answer remains correlated and is delivered | Signed answer reached the original work link despite suspended new-work grants | Pass — `assertQueuedOfficialAnswer` |
| Report custody | Both sites retain their own report records and official site header | Receiver archive contained its report; origin leader accepted and archived the same official answer with the receiving-site header | Pass — report archive assertions |
| Return to top level | No implicit republishing | Publication remained inactive until explicitly restored; reciprocal grant check passed only after explicit restoration | Pass — publication and grant assertions |
| Full isolated regression | No earlier federation scenario regresses | Runner returned `federationPair: passed` and `destinationSiteMove: true`, with `routable: false` | Pass — full pair runner |

`node --check tools/run-federation-pair.mjs` and `git diff --check` also passed. No failed attempt occurred in this run. This is evidence for the **receiving-site move and official-answer path**, not for simultaneous moves, cancellation during a move, normal UI operations, notifications, performance, print/PDF or security acceptance. Ordinary installations still have no federated work routes or remote task recipient selection.
