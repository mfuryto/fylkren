# Federation concurrency races — 2026-09-27

## Scope and environment

The disposable `tools/run-federation-pair.mjs` harness built the current API and created two independently initialized Enterprise instances, two PostgreSQL databases, a second receiver API replica and the TLS proxy from `tools/e2e/federation-pair.compose.yaml`. The databases, signing keys, licenses, users, sites and work were synthetic and were removed with the containers and volumes after each run.

The run exercised the complete maintained federation pair sequence, not only the new controls. The final output reported `federationPair: passed`, including `answerCancellationRaceSerialized`, `revocationSendRaceBlocked` and `siteMoveSendRaceBlocked` together with automatic key rotation, live capability negotiation and classified task/report preservation.

## Observed controls

| Control | Expected and observed result | Result |
| --- | --- | --- |
| Answer versus cancellation | A PostgreSQL row lock held the receiver work item while the real answer command and signed cancellation receiver both waited. After release, exactly one transaction won. The losing action returned/confined a conflict; the two nodes did not record both answered and cancelled terminal outcomes. | Pass |
| Grant revocation versus send | An outbox table lock held a sender command after its authorization read but before commit. The receiver revoked its inbound grant before the commit was released. Delivery was rejected as `remote_grant_denied`, reached bounded permanent failure and created no receiver work link. | Pass |
| Receiver-site move versus send | The same pre-check/post-commit boundary was held while the receiver site moved below a new parent, suspending publication and grants. Delivery was rejected as `remote_grant_denied`, reached bounded permanent failure and created no receiver work link. Returning the site to root did not silently restore publication or grants; the test restored them explicitly. | Pass |
| Regression coverage | The remainder of the pair sequence passed, including replay/deduplication, mutual proof, bilateral grants, outage/recovery, sequential moves, official reports, cancellations, signed receipts, automatic key rotation and classifications. | Pass |

## Deviation and clean rerun

The first attempt failed before exercising the answer/cancellation race because the test used `psql` output as its lock-acquired signal; that output was delivered only after the command completed, so no API request actually waited on the lock. The harness was corrected to observe the active lock-holder from a separate PostgreSQL connection while it was sleeping and then count real lock waiters. A complete clean rerun from fresh disposable volumes passed. This was a test-synchronization defect; no application control was changed to obtain the pass.

## Commands and exclusions

`node --check tools/run-federation-pair.mjs` passed before the clean run. `node tools/run-federation-pair.mjs` produced the passing final JSON and removed its disposable project. Raw container logs were observed during the run but were not retained as a separate artifact; the executable assertions in the harness are the evidence reference.

This run is API/database evidence. It did not verify browser presentation, notifications, PDF/print, representative proxy latency or load, long-term retention, lost-key recovery, real old/new-binary rolling upgrades, matched database/Data Protection restore or independent penetration testing. Federation work routing remains confined to `FederationTest`.
