# Internal experience-based learning — 2026-10-02

Based on `9aae8b8`. The final-report editor adds numbered positive/improvement points in separate internal storage. The new compact Learning page has exact-level access, priorities, action plans, deadlines, accountable treatment, retained comments/history and pending navigation counts. See [the learning guide](../../../docs/administration/LEARNING.md).

## Evidence

The 130 frontend tests in 38 files passed. Workspace typechecks and production builds passed. The existing bundle-size warning remains. The isolated Community/Enterprise PostgreSQL/API harness passed, including the new migration and the existing operational, identity, report, risk, comments and portability scenarios. Source structure, repository language, documentation links and version consistency passed.

| Control | Observation | Result |
| --- | --- | --- |
| Atomic report/point validation | Invalid point left both report and learning unchanged | Passed |
| Retry deduplication | Repeated report payload retained two points with stable numbers | Passed |
| Read/write scope | Members could read/comment; treatment required level leadership | Passed |
| Internal hierarchy boundary | Top leader could read eligible formal report versions but could not read subordinate learning | Passed |
| Administrative boundary | Administrative-only identities could not list, comment or treat learning | Passed |
| Report separation | Private sentinel absent from approved report versions and report archive responses | Passed |
| CSRF | Missing-token review rejected | Passed |
| Treatment validation | In-progress plan/deadline, closure outcome and fresh reopening rationale required | Passed |
| Concurrent revisions | Exactly one concurrent review committed; the other returned 409 | Passed |
| Retention and count | Closed points retained in history and removed from pending counts; reopening restored count | Passed |
| Discussion pagination | More than 20 comments/history entries returned without duplication | Passed |
| Site administrative audit | Event/task reference shown without internal point text | Passed |
| Full Site portability | Point/entry datasets and all author/responsible references retained and validated | Passed |
| Browser interaction | Real components processed points, added comments, updated counters and kept report content separate | Passed |
| Responsive UI | 390 × 844 layout had internal table scrolling and no document/dialog overflow | Passed |
| Runtime browser errors | No exceptions in Norwegian or English fixtures | Passed |

The browser harness is `tools/e2e/learning-browser.mjs`, using Vite at `127.0.0.1:19226` and temporary local Chromium CDP at `127.0.0.1:19224`. The maintained `/test-fixtures/learning-preview.html` fixture imports real components and mocks HTTP data. Browser evidence therefore covers UI behavior; persistence and permissions are independently tested against real PostgreSQL/API endpoints in `tools/e2e/learning.mjs`. English synthetic screenshots are retained in the manual; other screenshots are temporary evidence.

## Corrections

The first frontend run found lower-case Site terminology in new translations; all new messages now follow the existing reserved terminology. The first API run passed the learning treatment and privacy assertions but stopped because the new test incorrectly expected top leadership to access a different level's report archive. The test now preserves the existing exact-level archive restriction and separately verifies the authorized formal-version/report responses. Learning authorization also resolves the designated top-leadership context through the existing top-level policy. The final rerun passed.

## Limits and cleanup

No production deployment, live customer data, manual screen-reader evaluation, load test, full ASVS/security verification or independent penetration test was performed. This change does not complete the wider security release gate. Actual PDF-print and federated delivery tests were not repeated with learning sentinels; these paths continue to consume separate final-report content rather than learning records, and the maintained release matrix explicitly requires sentinel verification. Complete administrative Site exports/backups deliberately include internal learning for recovery.

The migration adds `learning_lessons` and `learning_entries` without changing historical report content. Existing report clients may omit the new optional draft array. The isolated API harness removes its containers/volumes; temporary Vite and Chromium are stopped after UI verification.
