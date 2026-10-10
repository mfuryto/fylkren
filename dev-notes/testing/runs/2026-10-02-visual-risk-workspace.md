# Visual risk workspace — 2026-10-02

Based on `aa17078`. The user selected the existing 1–5 assessment scale and score boundaries. The task dialog now combines a numbered register, initial/residual assessment map and mitigation editor. See [risk management](../../../docs/administration/RISK_MANAGEMENT.md) for the implemented behavior and a synthetic screenshot.

## Evidence and observations

Frontend tests: 123 tests in 36 files passed; workspace typechecks and production builds passed. The isolated Community/Enterprise Compose API harness exited successfully, including risks, actions, approval versions, authorization boundaries, comments and portability. The existing production bundle-size warning remains.

| Control | Observed result | Status |
| --- | --- | --- |
| Assessment scale and severity | All 25 cells match existing product score boundaries; high probability appears at the top | Passed |
| Coincident markers | Before/after markers and risks sharing a cell receive distinct positions | Passed |
| Missing residual assessment | No invented residual marker; invalid draft coordinates omitted | Passed |
| Editor order | Mitigation text and deadline appear before residual fields | Passed |
| Combined creation | Risk, first action, owner, deadline and residual score returned together | Passed |
| Invalid first action | Short/overlong action rejected without a partial risk record | Passed |
| Existing risk/actions | Existing creation, revisions, completion and stale-version rejection remain valid | Passed |
| Real Chromium pointer input | Cell selection and dragging update the intended before/after numeric fields | Passed |
| Browser save/reload presentation | Changed coordinates appear in the register after a mocked save/reload | Passed |
| Responsive layout | At 390 × 844 the table scrolls internally without document overflow | Passed |
| Runtime browser errors | Zero browser exceptions in Norwegian and English fixtures | Passed |

The maintained browser harness is `tools/e2e/risk-workspace-browser.mjs`. Start the web Vite server on `127.0.0.1:19226` and an isolated Chromium CDP endpoint on `127.0.0.1:19224`; the fixture is `/test-fixtures/risk-workspace-preview.html`. `?language=en-US` selects the documentation language. The fixture uses the actual components with synthetic, mocked HTTP responses and is excluded from the production entry point. Browser assertions therefore verify interaction and presentation; persistence and permissions are verified separately by the real PostgreSQL API harness in `tools/e2e/decisions-risks-versions.mjs`.

Screenshots were inspected at desktop and mobile widths. The English register screenshot is retained in the risk-management manual. Other screenshots and command logs are temporary evidence rather than release artifacts.

## Deviation

The first drag assertion measured its start and end positions after separately scrolling each element into view, making the start coordinate stale. Both positions are now measured at the same scroll offset. The clean reruns passed. Visual inspection also led to compact action controls on the register and side-by-side numeric assessment fields.

## Limits and cleanup

No production, PDF-export, notification-delivery or manual screen-reader checks were performed. The cell colors represent entered assessments rather than evidence of mitigation effectiveness. The Chromium container and Vite process are temporary; the API harness removes its disposable containers and volumes on completion. No database migration or changes to historical scoring were needed.
