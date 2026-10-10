# Federated answer recovery after an outage and site move — 2026-09-25

## Run context

- Test tool: `node tools/run-federation-pair.mjs`, including `assertQueuedAnswerSurvivesOutageAndMove`.
- Application base commit: `e6fed08`; the test-code changes described here were uncommitted during the run.
- Environment: disposable `FederationTest` pair with distinct instance identities, separate PostgreSQL databases, a TLS proxy and a second API replica on the receiving database. All sites, leaders and assignments were synthetic.
- Fixture reset: fresh containers and volumes; the runner removed them after completion. Raw HTTP and SQL logs were not retained.

## Scenario

The origin sent an assignment and received a signed delivery receipt. The test then stopped only the **origin API container**. While it was unavailable, the receiving site approved and queued its official answer. The sender-side transport attempt failed, leaving the answer retryable with an error code and attempt count. Before retry, the receiving site was moved below a parent, suspending its top-level publication. The origin API was restarted; it refreshed the now-inactive receiving-site catalog, and the existing answer was retried and accepted. The receiving site was restored to top level afterward, with publication and grants explicitly reactivated for subsequent scenarios.

| Control | Expected | Observed | Result / assertion |
| --- | --- | --- | --- |
| Outage isolation | Receiver remains operable while origin API is stopped | Receiver queued the official answer with origin API stopped | Pass — container stop and answer endpoint |
| Failure retention | Failed transport does not erase or complete the answer | Outbound message remained `retrying` with at least one attempt and a nonempty error code | Pass — queue-state assertion |
| Move during backlog | Receiver becomes a child and loses publication before retry | Publication inactive; origin's refreshed catalog marked receiver inactive | Pass — site API, database and catalog assertions |
| Controlled retry | Message does not escape the held retry window | Message remained `retrying` until `next_attempt_at` was advanced for the test | Pass — queue-state assertion |
| Recovery and custody | Same work link receives answer; each side archives its report | Signed answer delivered, origin leader accepted it, and both report archives retained the official receiver-site header | Pass — `assertOfficialAnswerDelivered` |
| Idempotency | Replaying the delivered message cannot duplicate its receipt | Replayed delivery completed with one inbound receipt | Pass — answer-retry assertions |
| Restoration | Root placement alone does not reauthorize new work | Publication remained inactive until explicitly restored; reciprocal check passed after both grants were restored, with `routable: false` | Pass — publication and grant assertions |
| Full regression | Earlier scenarios still pass | Runner returned `federationPair: passed` and `answerAfterOutageAndMove: true` | Pass — full pair runner |

`node --check tools/run-federation-pair.mjs` and `git diff --check` passed. No failed test attempt occurred in this run; the transport failure above was deliberately induced and asserted. The test controls one API outage and one receiver-site move; it does not prove arbitrary partitions, a move concurrent with delivery, operator recovery, notifications, normal UI workflow, performance, print/PDF or security acceptance. Production federation work routing remains disabled.
