# Instance federation foundation — 2026-09-23

## Run context

- Run ID: `instance-federation-foundation-2026-09-23`.
- Test tools: .NET build, Vite build, Vitest, structure checker, PostgreSQL read-only query, and `tools/test-e2e-local.mjs`.
- Source: local working tree based on `0254ff0`, including this foundation change before commit. The test-code revision is the same working tree.
- Environment: isolated `fylkren-e2e` Docker Compose project bound to `127.0.0.1:18080`, with a fresh PostgreSQL database and synthetic users/sites. No shared deployment was changed.

| Control | Expected | Observed | Result / evidence |
| --- | --- | --- | --- |
| API and web build | Both compile | Both completed without errors | Pass; `dotnet build apps/api/Fylkren.Api.csproj --no-restore`, `pnpm --filter @fylkren/web build`. |
| Web tests | Existing UI logic remains valid | 22 files, 71 tests passed | Pass; `pnpm --filter @fylkren/web test`. |
| Repository structure | No structure-rule regression | 335 source files checked | Pass; `pnpm check:structure`. |
| Migration | Fresh database receives one installation identity | `instance_identity` had one row with key `1` and a nonempty UUID | Pass; read-only PostgreSQL query after container startup. |
| Restart durability | API restart does not regenerate identity | The same UUID and creation timestamp were observed before and after isolated API restart | Pass; repeated read-only PostgreSQL query. Raw command output was not retained. |
| Local recipient search | Authorized local destination includes stable `instanceId` | Two searches returned the same valid instance ID for a synthetic destination site | Pass; assertions in `tools/test-e2e-local.mjs`. |
| Existing local work flow | New identity field does not break task operations | All end-to-end scenario flags passed, including planning/execution/report, cross-site requests, site moves, hierarchy, isolation, and authorization | Pass; `pnpm test:e2e:local` exited `0`. |
| Test cleanup | No disposable state remains | `fylkren-e2e` containers, network and its two volumes were removed | Pass; `docker compose -p fylkren-e2e down -v`. |

No failed or corrected attempts occurred in this run. The E2E output was observed during the run but not retained as a separate log artifact. This run did **not** test two independent Fylkren databases communicating, peer authentication, Enterprise entitlement, offline delivery, remote site discovery, retries, or federation transport. Those capabilities do not exist in this foundation and remain explicit future implementation gates in [the architecture contract](../../architecture/INSTANCE_FEDERATION.md). Manual browser UI, SMTP delivery, PDF/print, performance and security tests were also excluded. Federation itself is not a release-ready feature.
