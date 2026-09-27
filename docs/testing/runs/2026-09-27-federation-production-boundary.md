# Federation production-routing run - 2026-09-27

Run ID: `federation-production-routing-2026-09-27`. The maintained `--production-boundary-only` harness mode and the implementation were the uncommitted revision under verification. Two fresh Enterprise installations ran with independent PostgreSQL 18 databases, Data Protection key rings, Instance IDs, federation keys and Platform Manager accounts behind the TLS Nginx → built web/Nginx → API path. Every API process used `ASPNETCORE_ENVIRONMENT=Production`, not `FederationTest`.

The final clean command was `node tools/run-federation-pair.mjs --production-boundary-only`. It exited zero, reported `federationProductionBoundary: passed`, and removed all disposable containers, networks and volumes.

| Control | Expected | Observed | Result / evidence |
| --- | --- | --- | --- |
| Migration/default | Routing setting is created disabled | Both fresh databases reported `enabled: false` | Pass; Platform Manager routing API |
| Readiness guard | Activation before an approved and proved peer exists fails closed | HTTP 409 named the missing peer proof | Pass; no audit/state change |
| Administrative setup | Identity, bilateral discovery/approval/probe and automatic top-level site catalogs work while disabled | Complete bilateral setup succeeded without publication or site permissions | Pass; assertions through both TLS proxies |
| Disabled work boundary | Four work routes return 404 and no remote recipient is offered | All returned 404; recipient absent | Pass; fully licensed and connected pair |
| Disabled persistence | Setup alone creates no work transport state | Zero outbound messages and inbound receipts | Pass; database assertions |
| GUI/API readiness | Production setup is reported ready and activation is authenticated, antiforgery-protected and persisted | Both Platform Manager sessions enabled routing | Pass; same API used by Federering page |
| Audit | Each activation creates one platform event | One `federation-routing.enabled` event per database | Pass; direct count |
| Operational selection | Authorized remote top-level site appears after activation | Ordinary site-leader search returned the exact remote address | Pass |
| Production delivery | Ordinary work creation queues and delivers a signed assignment | Sender stored signed receipt/counterpart; receiver stored exactly one task and receipt; forced retry remained idempotent | Pass |
| Deactivation | Platform Manager can stop routing without restart or data deletion | State disabled, remote recipient disappeared and audit event was stored | Pass |
| Synthetic isolation | Test producer/return/acceptance routes remain unavailable | All five returned 404 before and after activation | Pass under `Production` |

Two earlier attempts are retained as deviations. The first stopped during migration because a hand-authored `InsertData` operation lacked target-model type metadata; it was replaced by an explicit typed PostgreSQL insert and rerun from fresh volumes. The second reached successful production delivery but failed on a stale harness assertion that assumed the receiver display name was always `Synthetic Root b`; the assertion was changed to the receiver fixture's actual name and the complete run passed cleanly.

This is maintained regression evidence, not an independent penetration test or organizational authorization to activate production federation. It excludes customer infrastructure, production backup custody, release-candidate image digests, manual rendered-browser inspection of the new activation control and the independent reviewer's adversarial cases.

The earlier complete regression referred to the superseded site-grant model and remains historical evidence only. The maintained production-boundary regression now verifies the current automatic-site model: bilateral approval and proof, signed catalog exchange, routing disabled by default, ordinary remote-recipient selection and signed production delivery after activation, deactivation, and absence of synthetic test routes.
