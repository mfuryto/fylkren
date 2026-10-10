# Localization context follow-up — 2026-10-02

This follow-up revisits the linguistic conclusions in the [previous audit](2026-10-01-localization-quality-audit.md). Structural completeness alone did not prevent incorrect operational meanings. The Norwegian workflow context and actual state transitions are now explicit interpretation inputs in the [term base](../../../docs/product/LOCALIZATION_TERMINOLOGY.md).

## Scope and observations

Reviewed task-state labels across all 19 catalogs, selected deadline and author labels, workload descriptions, and the recently reused notification and report help text. Targeted corrections affect the 17 non-English catalogs. English variants retain their source text. Overview counters now use the corresponding task-state wording throughout non-English catalogs.

| Control | Observation | Result |
| --- | --- | --- |
| Execution meaning | Capital-punishment vocabulary appeared in Danish, Finnish and Estonian workflow, history, queue and audit text; replaced with operational task execution | Corrected |
| Task-state meaning | Ukrainian labels confused paused, assigned, rejected and execution states with actions or unrelated concepts; Swedish cancellation and withdrawal were also incorrect | Corrected |
| Deadline meaning | Polish used payment deadline, Ukrainian event date, Dutch expiry date and Swedish retained an English fragment | Corrected |
| Workload help | Multiple catalogs described recordings, recruitment or malformed work-item concepts; monthly measurements and the distinction from staffing/capacity restored | Corrected |
| Notification help | Selected messages confused manager hierarchy, submission for approval and submission for verification | Corrected |
| Report help placement | General archive help reused an API-specific note; removed that note from the archive dialog, retaining it in API administration | Corrected |
| Overview consistency | Duplicate state labels differed from task-card meanings | Aligned, with regression coverage |

## Validation and limits

Evidence is maintained in `apps/web/src/localization/localization.test.ts` and `apps/web/src/localization/workflowTerminology.test.ts`. Validation includes the full frontend unit suite, TypeScript checks, production builds, source structure, documentation links, repository language boundaries and whitespace checks. Logs are local temporary output and are not retained release artifacts.

An initial terminology regression matched a substring inside the Finnish word for lists. The check now requires a Unicode letter boundary. An initial unprivileged test invocation failed before useful test output; the suite was rerun with cache access.

This is a focused semantic follow-up, not exhaustive native-speaker certification of every catalog sentence. No fresh browser layout, PDF, SMTP delivery, backend or production checks were performed. Existing production bundle-size warnings remain. No fixtures or production data were changed.
