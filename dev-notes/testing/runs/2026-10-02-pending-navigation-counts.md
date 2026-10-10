# Pending-work navigation counts — 2026-10-02

Based on `6944356`. Workload moves after Reports. The Overview action text list is removed, while its summary counter remains. Tasks, Planning and Execution show positive pending counts after their localized navigation labels.

## Validation

The 125 frontend tests in 37 files passed, including navigation ordering, positive/zero/unavailable labels and mutation-triggered refresh. Workspace typechecks and production builds passed. The existing frontend bundle-size warning remains.

The isolated Community/Enterprise PostgreSQL/API integration harness exited successfully, including the new pending-count assertions, authorization boundaries and the existing operational regression suite. Its disposable containers and volumes were removed.

The new integration assertions cover a registered task, transition to available planning, claiming planning, transition to available execution, claiming execution, and zero operational counts for administrative accounts. Server counts use the authenticated person's active site memberships and existing level authorization, rather than accepting a person identifier or counting the visible page. Planning shares the queue's active-run query. Opening a page does not acknowledge or clear work.

## Deviation and limits

The initial Docker build failed while extracting a cached image layer after the API had compiled. A normal rerun recovered without changing application code or modifying production services.

No production deployment or manual browser/screen-reader validation was performed. Counts span authorized sites and levels and do not follow local page filters. The Overview summary includes urgency as well as pending decisions, so its value can differ from navigation totals. No database migration is required. The disposable integration harness removes its containers and volumes on completion.
