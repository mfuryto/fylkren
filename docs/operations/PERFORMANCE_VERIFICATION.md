# Performance verification

This document defines the maintained performance baseline and the evidence still required before a production release. Capacity profiles and initial sizing are documented in [System requirements](SYSTEM_REQUIREMENTS.md).

Registered users are not the primary sizing variable. Concurrent activity, request rate, active task trees, retained history, PostgreSQL working set, disk latency, WAL, backups, notification volume, and report generation determine actual capacity. A deployment with 1,000 registered users and 15 active users can resemble one with 100 registered users and the same activity.

## Current status

| Area | Implemented baseline | Required release evidence |
| --- | --- | --- |
| Database schema and indexes | Composite indexes match central queues, audit, roles, and notification access patterns | `EXPLAIN (ANALYZE, BUFFERS)` with representative volumes |
| Tasks, Planning, and Execution | Server-side paging; bounded rich projections; shared hierarchy and authorization loaders | Load test deep chains, many levels, searches, direct links, and concurrent mutations |
| Reports | Range-based year filter, server-side search/paging, bounded detail loading | Long-history search, yearly filters, print/PDF preparation, and classified access |
| Workload history | Active-only queries and bounded twelve-month event extraction | Compare against known fixture and measure multi-year history |
| Notifications and audit | Indexed queue/audit cursors and database-side audit pagination | Continuous writes, retry backlog, late pages, and worker recovery |
| Authorization | Batched membership/role checks rather than per-level queries | Full access matrix with large sites and many roles/levels |
| Concurrency | PostgreSQL `xmin` optimistic concurrency on operational entities | Parallel state transitions and overlapping autosave |
| Web navigation | Shared short-lived context/data cache and authenticated route preloading | Browser p50/p95/p99 and visual stability on representative networks |
| EF collection loading | Explicit split-query behavior for multiple related collections | SQL count and response measurements for large workflows |

Implemented means the optimization exists and passes build/regression checks. It does not mean the production capacity claim is verified.

The federation receiver's security-control baseline is recorded separately in the [2026-09-27 proxy/load run](../testing/runs/2026-09-27-federation-proxy-load.md). Through the supported two-hop proxy chain it accepted the complete 20-request fixed window concurrently, rejected request 21, preserved separate client and capability partitions, rejected oversized route bodies and kept signed discovery responses bounded. Those measurements verify enforcement, not sustained delivery throughput or a production capacity limit.

The [2026-09-27 federation retention/load run](../testing/runs/2026-09-27-federation-retention-load.md) added 5,000 expired and 50,000 recent rows per federation-history category. Bounded maintenance removed exactly the expired terminal history and retained recent, active, failed and pending controls. Analyzed plans used the peer/status outbox index for delivery counts (14.752 ms), peer/created-time for newest 100 (0.175 ms), receipt primary key for replay lookup (0.151 ms), and occurred-time audit cursor for newest audit (59.757 ms). These single-host measurements establish the maintained query shape, not a production throughput or capacity claim.

## Implemented query protections

### Queue and ordering indexes

Composite indexes cover site/status/created-time task queues, notification status/created-time queues, stable audit projection cursors, active role assignments, and workflow selection. Redundant single-column indexes were removed where the composite left prefix covers the same access path.

Large production upgrades must measure index build time and locking on a representative database copy and use a maintenance window when necessary.

### Sargable report years

Year filtering uses a half-open UTC interval from 1 January to the following 1 January instead of calculating a year for every row. PostgreSQL can therefore use the approval timestamp index directly.

### Batched authorization

Planning and execution load active membership, roles, planner authority, leader authority, and deputy authority once per request and evaluate all relevant work levels from that bounded set. Execution filters unauthorized rows before projecting workflow documentation and timelines.

### Database-side audit pagination

Platform user and machine audit events are combined before sorting, `Skip`, and `Take`. A late page materializes only its requested rows rather than every preceding page.

### Bounded workload and hierarchy loading

Current workload excludes terminal tasks in the database. The twelve-month graph loads one necessary baseline event per task plus events inside the period. Task/report context loads only required ancestor chains, not the complete site history.

### Operational concurrency

Tasks, planning/execution runs, and step documents use PostgreSQL `xmin` as an optimistic concurrency token. Conflicting writes return HTTP `409` with `concurrency_conflict` rather than silently allowing last-write-wins loss.

### Scoped cancellation

Cancellation resolves the selected root, linked request receiver where applicable, and only actual descendants. It does not materialize the platform's entire task history. Related operational changes and audit events commit atomically in one database save.

### Server-side operational pagination

Tasks, Planning, Execution, and Reports count, filter, order, and page in PostgreSQL before loading rich detail. Direct permalinks calculate the relevant page without transferring preceding pages. Task search retains whole-chain matching but rich search fields are projected only when a non-empty search term is present.

### Short-lived browser request sharing

Authenticated pages share work-context and selected overview requests in a user/site-scoped in-memory cache for at most 60 seconds. Concurrent consumers share the same in-flight request. Successful mutation or authentication transition invalidates it immediately. Responses remain `no-store` and nothing is persisted to browser disk storage.

Common operational route bundles are prefetched after authentication. Overview begins context, task, and workload requests before the page module finishes mounting.

### Split collection queries

EF Core uses `QuerySplittingBehavior.SplitQuery` for read models containing multiple related collections, preventing cartesian row multiplication. These views tolerate a simultaneous change becoming visible on the next refresh; mutation transactions are unaffected.

## Measurement scenarios

Use generated synthetic fixtures representing at least:

- shallow and deep organizations, including Staff, teams, and recursive child sites;
- active, waiting, overdue, completed, cancelled, reopened, and reassigned chains;
- more than 20 items in every paginated queue;
- long rich-text fields, timelines, workflow steps, links, and reports;
- large personnel/role sets and many authorized work levels;
- sustained notification creation with retry failures;
- mixed platform and site audit history;
- classified and unclassified reports across several years.

Measure cold and warm behavior. Record database size, row counts, host resources, PostgreSQL settings, concurrent users, request mix, p50/p95/p99 latency, throughput, error rate, transferred bytes, query count, query plan, buffer use, API memory, CPU, disk latency, and WAL growth.

## Required regression checks

- Counts and search results remain identical before and after an optimization.
- Site, level, role, and cross-site isolation remain enforced.
- Newest-first order, filters, pagination, and permalinks remain stable.
- A queue item disappearing after a transition does not create an empty or invalid page.
- Concurrent changes return controlled conflicts and preserve both users' content.
- Cancellation changes only the selected linked chain.
- Notification processing neither loses nor duplicates a delivery because of retries.
- Platform logs contain no EF multiple-collection warning after representative detail loads.
- Short-lived frontend caches never reuse another user, site, or work-level context.

## Optimization policy

Do not introduce denormalized read models, trigram indexes, pre-aggregated workload tables, distributed caches, or additional services without measurements showing a current bottleneck. Every optimization must preserve the domain and authorization model and include a regression test.

The single-host profile must be measured before any capacity statement is promoted from planning guidance to a supported limit. Multi-node scaling is not part of the current supported profile or roadmap.
