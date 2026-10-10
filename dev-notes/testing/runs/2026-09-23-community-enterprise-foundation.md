# Community/Enterprise foundation — 2026-09-23

## Run context

- Run ID: `editions-foundation-2026-09-23`.
- Test tools: Docker Compose, `tools/run-e2e-editions.mjs`, `tools/test-e2e-local.mjs`, Vitest, .NET build and repository structure checker.
- Source: local working tree based on `79523c2`, with the entitlement implementation and test code in this change set. The first clean E2E pass preceded the display-version bump; the final pass rebuilt the `0.67.0` API image and included direct identity/webhook gate assertions.
- Environment: dedicated `fylkren-edition-e2e` Compose project on `127.0.0.1:18081`, fresh PostgreSQL and Data Protection volumes, synthetic accounts/sites, and a newly generated ephemeral P-256 issuer. No shared or production deployment was changed.
- Evidence: E2E assertions in `tools/test-e2e-local.mjs` and its imported modules; final JSON output reported `editionsAndTransitions: passed` and every existing scenario flag passed. Console output was observed but not retained as a separate log artifact.

| Control | Expected | Observed | Result / assertion |
| --- | --- | --- | --- |
| Community startup | Fresh installation works without a license | Public configuration and Platform Manager license status reported `community`, `none`, and no entitlements | Pass; initial license/config assertions. |
| Community API enforcement | Enterprise machine-client creation is rejected | `403` returned | Pass; `blockedClient` assertion. |
| External identity and webhook enforcement | New external identity links and webhook subscriptions are rejected in Community | Both direct API calls returned `403`; the entitled identity call reached ordinary user validation (`404` for a nonexistent synthetic account) | Pass; `blockedExternalLink`, `blockedWebhook` and `enabledExternalLink` assertions in the final pass. |
| Signature, instance and time validation | Tampered, wrong-instance and expired envelopes are rejected without changing edition | All three imports returned `400`; edition stayed Community | Pass; invalid-import assertions. |
| Enterprise activation | Valid offline P-256 signed envelope activates feature IDs without restart | Import returned `200`; both restricted status and public configuration reported Enterprise and `external-identity` | Pass; `enabledLicense`/`enterpriseConfig` assertions. |
| Protected work while entitled | Existing administration/report API and webhook paths continue to function | Full E2E flags `administrationReportApis` and `webhookFailureIsolation` passed | Pass; imported scenario assertions. |
| Live expiry | An installed valid license crosses its expiry time without removal or restart | Not exercised in this run. An already-expired envelope was rejected at import; an active license was later explicitly removed. | Not tested; retain as a later release gate. |
| Removal and data retention | Removing the license leaves Community usable | Removal returned success, edition was Community, normal customer work remained accessible | Pass; removal and readback assertions. |
| Existing domain workflows | Edition architecture does not split or break core flows | Planning, execution, reporting, hierarchy, requests, risk, dependencies, portable export and authorization flags passed | Pass; final E2E JSON. |
| Web controls | Entitled creation controls differ between Community and Enterprise | 23 Vitest files and 73 tests passed, including the new edition-control test | Pass; `pnpm --filter @fylkren/web test`. |
| Final source build | Version `0.67.0` builds with no compilation errors | .NET build completed with 0 warnings/0 errors; production web build completed | Pass; `dotnet build apps/api/Fylkren.Api.csproj --no-restore` and `pnpm --filter @fylkren/web build`. |
| Source structure | New licensing files satisfy repository structure rules | 342 source files checked | Pass; `pnpm check:structure`. |
| Disposable-state cleanup | Test project leaves no synthetic data running | Compose stopped and removed web/API/PostgreSQL containers, network and both volumes | Pass; final `down -v` output. |

The first E2E attempt failed before these controls because `tools/e2e/administration-report-apis.mjs` still hardcoded port `18080` while this isolated project used `18081`. The helper now reads `FYLKREN_E2E_BASE_URL`; a clean rerun passed. The failed attempt and correction are retained here rather than erased.

This run does **not** establish final 1.0 acceptance. It did not verify a real production issuer key, key rotation, manual browser usability, live AD/LDAP/OIDC/SAML sign-in after license expiry, SMTP delivery, PDF/print, load/performance or ASVS security controls. Those remain separate release gates. At the time of this historical run the repository was under MPL-2.0; the later source-available licensing change does not alter this test evidence. Production key management and independent legal/commercial review remain required before public release. No production key material or customer data was used.
