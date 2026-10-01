# Task next-action consolidation — 2026-09-23

## Scope and environment

| Field | Value |
| --- | --- |
| Change base | `30c689b` |
| Test time | 2026-09-23 11:30 UTC |
| Tools | Vitest, TypeScript/Vite build, source-structure check, .NET build |
| Environment | Local source checkout; no browser deployment or database fixture |
| Result | Automated checks passed; interactive acceptance remains pending |

## Checks and observed results

| Control | Expected | Observed | Result |
| --- | --- | --- | --- |
| Task under review | One “Next step” panel contains leader decisions and the eligible request action | Static-render assertion found exactly one action panel, including “Approve and allocate” and “Send request”; no separate manager-decision panel | Pass |
| Plan awaiting approval | Plan decisions are visible only to the level's manager | Static-render assertions found “Godkjenn plan” for manager and not for non-manager | Pass |
| Final-report review | Writing/editing, approval and return share “Next step” | Static-render assertions found writing and return before a report, editing and approval after saving | Pass |
| Execution-stage request on Tasks | No side-request action is offered in the task card | Policy assertion returned false for `execution`, true for `under_review` | Pass |
| Frontend regression | Existing unit tests and production bundle remain valid | `pnpm --filter @fylkren/web test`: 20 files, 66 tests passed; `pnpm --filter @fylkren/web build`: exit 0 | Pass |
| Source structure | Files remain within configured source limits | `pnpm check:structure`: 329 files checked, exit 0 | Pass |
| API compilation | Existing request API remains buildable | `dotnet build apps/api/Fylkren.Api.csproj --no-restore -v:q`: 0 warnings, 0 errors | Pass |

The static-render assertions are in [TaskActionPanels.test.tsx](../../../apps/web/src/tasks/TaskActionPanels.test.tsx) and the status-policy assertion is in [taskPolicy.test.ts](../../../apps/web/src/tasks/taskPolicy.test.ts). Test output was observed in the local terminal, not retained as a raw-log artifact. No credentials or real user data were used.

## Limits

This run did not exercise the deployed browser, a real plan approval, a final-report approval, request submission from an execution workflow, or role changes against an API-backed site. Those remain acceptance checks after deployment. In particular, the new execution request control is shown only when the current executor also has management authority for that item; this permission combination needs a live acceptance test.
