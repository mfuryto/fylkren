# Community/Enterprise API regression - 2026-09-27

Run ID: `community-enterprise-api-regression-2026-09-27`. The exact tested source was clean commit `6ffc4a3`; `Directory.Build.props` identified the built application as `0.69.1`, although the final harness summary did not independently print the authenticated version response. The entry-point SHA-256 was `eab11241dc442cbd1cf44722bcef92d3c1a29cefa39b3998855b28b4cde6d0e2` for `tools/run-e2e-editions.mjs`, the API scenario runner was `1f8bd4198bce529258abbe89c49e410b2c35a6adb812feaa979e8139ca49ad85`, and the synthetic pre-signed license fixture was `641c1555de3b18e2deefacc68e959b67a6864758809d14d10dd2596e310d1ea6`.

The clean command was `pnpm test:e2e:local`. It built the common API/web artifacts, created fresh PostgreSQL and Data Protection volumes in the reserved `fylkren-edition-e2e` project, and used generated `example.invalid` identities and task data. The command exited zero with 28 `passed` summary flags, then removed its web, API and PostgreSQL containers, both networks and both volumes. Raw terminal logs were observed but not retained separately; generated credentials and machine secrets remained in process memory and were not printed.

| Control group | Expected | Observed | Result / evidence |
| --- | --- | --- | --- |
| Edition lifecycle | Community bootstrap, invalid-license rejection, Enterprise activation and safe removal use one build/schema | `editionsAndTransitions`, `bootstrap` and `roleSetup` passed | Pass; runner assertions |
| Local workflow | Planning, execution, reports, transitions and combined branches preserve state and ownership | `localPlanningExecutionReport`, `combinedBranches` and `transitionChains` passed | Pass; runner assertions |
| Hierarchy and routing | Three-level distribution, parent/child and three-site reporting, moves, snapshots and recursive workload remain correct | Eight hierarchy/routing flags passed | Pass; runner assertions |
| Cross-site requests | Response/cancellation, isolation and report archives remain correct | Four cross-site/report flags passed | Pass; runner assertions |
| Authorization | Operational isolation and role/object boundaries reject unauthorized access | `operationalIsolation` and `authorizationBoundaries` passed | Pass; direct HTTP assertions |
| Platform APIs | Administration/report APIs enforce scopes, grants, ETags, idempotency and classified-report boundaries | `administrationReportApis` passed | Pass; dedicated module assertions |
| Extended domain | Dependencies, decisions, risks and immutable approval versions remain consistent | `dependencies` and `decisionsRisksVersions` passed | Pass; dedicated module assertions |
| Integrations and exit | Webhook failure isolation and portable export/validation preserve tenant boundaries | `webhookFailureIsolation` and `portability` passed; portable fixture contained 47 datasets | Pass; dedicated module assertions |
| Federation foundation | Community gating and Enterprise federation candidate administration remain compatible with ordinary work | `federationCandidates` passed | Pass; candidate/grant assertions only, not work federation |
| Notification queue | Request events are queued without requiring an external SMTP server | `requestNotificationsQueued` passed | Pass; database/API assertions |
| Lookup | Task/person lookup and sorting remain stable | `lookupSorting` passed | Pass; runner assertions |
| Disposable cleanup | No synthetic database or key volume remains after the run | Containers, networks and both volumes removed | Pass; final Compose output |

This run is the latest clean automated API regression for the shared Community/Enterprise artifacts. It is not the complete release acceptance matrix: it does not provide a manual browser/device pass, PDF/print inspection, real SMTP/STARTTLS delivery, live license-expiry crossing, closed AD/LDAP/OIDC/SAML/WebAuthn integration, representative load, independent security review or production issuer/custody evidence. It therefore does not close roadmap gate 3 or authorize a 1.0 release.
