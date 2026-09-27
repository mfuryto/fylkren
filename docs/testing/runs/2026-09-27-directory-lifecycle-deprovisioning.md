# Directory lifecycle deprovisioning - 2026-09-27

Run ID: `directory-lifecycle-deprovisioning-2026-09-27`. The application base
was commit `b6e1cf9`; the uncommitted implementation under verification had
SHA-256 `b2af0baf1f07435ce214c02071babbb88515963799bac6693c7c3ab93bf0717f`
for `DirectoryLifecycleSynchronizer.cs`,
`4810dfaab2238df43ca93f5705581fffb8de09b999cb740cc98cf15043d36eea`
for `ExternalIdentityLink.cs` and
`63e7f12d9be96b0b840ae6916db6677632e789de3b98d0a84c97de1b26ab90ae`
for the protocol/state test. Verification completed at
`2026-09-27T23:56:27+02:00`.

The implementation adds periodic and manually triggered AD/LDAP lifecycle
lookup by stable directory ID. An authoritative disabled, expired or
active-filter result suspends the directory link immediately. A missing entry
requires three consecutive successful confirmations by default. An unavailable,
ambiguous or failed lookup does not suspend access and breaks the missing-result
sequence. Suspension retains the internal person, memberships, roles and
history, advances active login-identity security versions and records a durable
system audit event. An authoritative active result resumes the same link.

| Control | Observed result | Result / evidence |
| --- | --- | --- |
| API compilation | Debug build completed with zero warnings and zero errors | Pass; `dotnet build apps/api/Fylkren.Api.csproj --no-restore` |
| Lifecycle state transitions | Active, missing threshold, outage reset, suspension, capped repeated result, resumption and system audit actor behaved as specified | Pass; 118 protocol/state assertions |
| Web behavior | Identity administration types compiled and all 84 tests passed | Pass; workspace typecheck and 28 Vitest files |
| Production web artifact | Vite production build completed | Pass; 170 modules transformed |
| Configuration | Compose accepted the new lifecycle variables with a synthetic required database secret | Pass; `docker compose config --quiet` |
| Documentation and structure | Documentation links and all 406 source-file structure checks passed | Pass; maintained repository checks |
| Fresh database migration | A new PostgreSQL 18 volume started and the API became healthy with the lifecycle schema and audit-actor constraint | Pass; full local edition E2E run |
| Full application regression | All reported Community/Enterprise, workflow, authorization, cross-site, API, webhook, portability and federation-candidate scenarios passed | Pass; `pnpm test:e2e:local`, exit zero |
| Disposable cleanup | Test containers, networks and volumes were removed | Pass; suite cleanup output |

This run proves the internal state machine, migration, application regression
and GUI build. It does not claim live-directory acceptance: disabled, expired,
deleted, restored and unavailable states must still be exercised against the
supported Samba/Active Directory and OpenLDAP laboratory targets before a
production-qualified release. That remaining requirement is retained in
E2E-14 and the security test plan; no live directory credentials or raw logs
were used or retained in this run.
