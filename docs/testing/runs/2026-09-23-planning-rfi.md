# Planning RFI log — 2026-09-23

## Scope and environment

The change was tested with synthetic accounts in a fresh, isolated `fylkren-e2e` Docker Compose project (PostgreSQL 18, API and web on `127.0.0.1:18080`). The test project and both synthetic volumes were removed after the run. No customer data or shared deployment was changed.

| Control | Expected | Observed | Result |
| --- | --- | --- | --- |
| Schema installation | New RFI table is created on startup | The first attempt exposed a missing EF model snapshot entry. After updating the snapshot, API started healthy and the full test completed. | Pass after correction |
| Create and update | A claimed planner can add an entry with multiline question, due date and answer status | `POST` returned `201`; `PUT` returned `204`; `GET` returned the saved multiline question. | Pass |
| One log per planning run | RFI survives plan correction and step changes | The returned plan queue still contained the same RFI ID and content; answer was saved before resubmission. | Pass |
| Site isolation | Another site's user cannot read the RFI | Cross-site `GET` returned `403`. | Pass |
| Approval history | Approved plan retains answer; later edits blocked | Work-item detail returned the answer; a later `PUT` returned `403`. | Pass |
| Broader workflow regression | Existing assignment, request, reporting, authorization, webhook and portability flows remain functional | `pnpm test:e2e:local` exit `0`; all reported scenario flags were `passed`. | Pass |

The API assertions are in [`combined-branches.mjs`](../../../tools/e2e/combined-branches.mjs). The full runner is [`test-e2e-local.mjs`](../../../tools/test-e2e-local.mjs). Frontend render tests are in [`PlanningRfiLog.test.tsx`](../../../apps/web/src/workflows/PlanningRfiLog.test.tsx); the web build, web test suite and source-structure check passed. This run did not include a manual visual inspection on a physical mobile device or a live-user concurrency test.
