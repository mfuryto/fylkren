# Frontend dependency security update — 2026-10-25

Scope: maintenance of the frontend build/test dependencies on top of commit `5dc653dcf156f0c885f1d39a566d6438812f0b9a`. Product version remains unchanged. No production data or services were accessed.

GitHub Dependabot alerts 2–7 identified vulnerable Vite 8.2.2. Both application manifests now require Vite ^8.3.5, and the shared lockfile resolves 8.3.5 throughout. This exceeds the alerts' first patched version, 8.2.4. Covered advisories: GHSA-698v-4r3x-3vcv, GHSA-587h-7wmj-h5pm, GHSA-r825-w8mm-5pxw, GHSA-vfpm-58rq-9qcg, GHSA-rq7h-c2jc-7f22 and GHSA-9jrq-w75r-8gcw.

The subsequent registry audit found two additional development-tool advisories in @vitest/mocker 4.1.11: GHSA-qxg6-89mg-rqv8 and GHSA-xp26-3454-mjgp. All three workspace manifests now require Vitest ^4.1.12, and the lockfile resolves the patched mocker 4.1.12.

| Verification | Observed result |
| --- | --- |
| `pnpm audit --json` | Passed: zero known vulnerabilities at every severity, including development dependencies |
| `pnpm typecheck` | Passed across all three frontend workspaces |
| `pnpm test` | Passed across all frontend workspaces using Vitest 4.1.12 |
| `pnpm build` | Passed: shared UI, demo and application production builds using Vite 8.3.5 |

The first Vite-only update left the existing shared Vitest installation link unresolved; the first test attempt failed before executing tests with `MODULE_NOT_FOUND`. Updating/installing the complete workspace Vitest dependency set resolved the link. The clean verification above ran after both updates. Raw command logs were not committed. Backend, browser acceptance and production deployment tests were outside this dependency-only change; mandatory GitHub checks remain enforced before main promotion. Registry audit results describe known advisories at verification time, not a guarantee against future findings.
