# Task lookup ordering — 2026-09-23

The task type, source type and sender lists were checked in a fresh, isolated `fylkren-e2e` Docker Compose project with synthetic users and site data. No shared deployment was changed; the disposable containers and volumes were removed after the run.

| Control | Result |
| --- | --- |
| Values inserted out of order (`Zulu`, `Echo`, `Beta`, `Alpha`) | All three authenticated API lists returned locale-aware alphabetical name order, independent of creation order. |
| `Alpha` deactivated after insertion | It remained alphabetically placed in the management list; filtering active values for selectors preserved alphabetical order. |
| Regression suite | `pnpm test:e2e:local` exited `0`, reporting `lookupSorting: passed` and all existing scenario flags `passed`. |

The automated assertions are in [`lookup-sorting.mjs`](../../../tools/e2e/lookup-sorting.mjs), invoked by [`test-e2e-local.mjs`](../../../tools/test-e2e-local.mjs). The test verifies API order consumed by both management lists and task selectors; it does not constitute a manual visual browser inspection.
