# Federated reply after both sites move — 2026-09-25

## Run context

- Test tool: `node tools/run-federation-pair.mjs` with `assertReplyAfterBothSitesMove`.
- Application base commit: `c525b08`; the test-code changes described here were uncommitted during the run.
- Environment: two disposable `FederationTest` installations with distinct instance identities, independent PostgreSQL databases, a TLS proxy and a second API replica on the receiving database. The runner created only synthetic sites, leaders and work items.
- Fixture reset: fresh containers and volumes, removed by the runner after the run. Raw HTTP and SQL logs were not retained.

## Scenario and results

A top-level origin sent one assignment to a top-level receiver and stored its signed delivery receipt. Both sites were then moved below separate parent sites, one after the other, **before** the receiver prepared its official answer. Each side refreshed its view of the other site's catalog. The receiver answered the original assignment; the origin leader accepted the answer. Both sites were returned to top level, but publication and site-to-site grants were restored explicitly rather than automatically.

| Control | Expected | Observed | Result / assertion |
| --- | --- | --- | --- |
| Both hierarchy changes | Both sites become children | Both site updates succeeded; neither retained active publication | Pass — `moveSiteBelowNewParent`, publication queries |
| Remote discovery | Each side sees the other as inactive | Both refreshed catalogs contained inactive snapshots | Pass — catalog assertions |
| New assignment | No new work is queued between child sites | Synthetic producer returned HTTP 409; outbound message count unchanged | Pass — producer and database-count assertions |
| Existing assignment | Stable work-link addresses permit signed return | Official answer was acknowledged and linked to the original work item despite both sites moving | Pass — `assertQueuedOfficialAnswer` |
| Report custody | Receiver and origin each retain the official report | Receiver report archive contained its answer; origin leader acceptance created the sender archive entry with receiving-site header | Pass — archive assertions |
| Restoration | Root placement alone does not republish or restore permission | Neither publication reactivated automatically; explicit publication, catalog sync and directional grants yielded a reciprocal check with `routable: false` | Pass — publication and grant assertions |
| Full regression | Earlier scenarios still pass | Runner returned `federationPair: passed` and `bothSitesMove: true` | Pass — full pair runner |

`node --check tools/run-federation-pair.mjs` and `git diff --check` passed. No failed attempt occurred in this run. The two moves were **sequential**; this does not prove behavior for concurrent move transactions, an answer/cancellation racing with a move, operator recovery or normal UI workflow. Production work routing remains disabled. Notification, performance, print/PDF and security acceptance were not tested.
