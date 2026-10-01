# E2E-01 browser observability follow-up - 2026-09-27

Run ID: `e2e-01-browser-observability-2026-09-27`. The application base was clean commit `2ed24de`; the maintained Chromium script (SHA-256 `c49cebd25130f494b21334313290833e3d11110e457e231fbfec8b8ba0704326`) and this record were the uncommitted test revision under verification. A fresh Community installation used PostgreSQL 18 and new database/Data Protection volumes in the isolated `fylkren-browser-acceptance` Compose project. Chrome 151.0.7922.109 ran from `chromedp/headless-shell:stable` against the built web/API services.

The clean command was `node tools/e2e/community-browser-smoke.mjs --task-flow`. The fixture enabled all site notification categories and gave the synthetic top-level leader Site Manager access solely so the same browser actor could inspect site audit. The operational task chain remained leader-driven through rendered controls. The final run exited zero with `topLevelTaskBrowserFlow: passed`, `overviewCounts`, `siteAudit` and `notificationQueue` true, no horizontal overflow at desktop or mobile report view, and `browserErrors: 0`.

| Control | Expected | Observed | Result / evidence |
| --- | --- | --- | --- |
| Active overview | Registered work appears once in action and active counts | Before assessment, `Requires action` and `Active` both rendered `1` | Pass; rendered overview cards |
| Completed overview | Completion clears active/action counts and updates annual statistics | Both live counts rendered `0`; registered/received and completed annual cards each rendered `1` | Pass; rendered overview cards |
| Site audit | Material task transitions are traceable | Audit UI rendered `Task registered`, `Execution submitted for review` and `Final report approved` | Pass; rendered site-audit assertions |
| Notification creation | Enabled task events create delivery records | At least one delivery for the exact synthetic task title appeared after the worker interval | Pass; authenticated platform delivery API |
| Disabled transport | With SMTP disabled, generated deliveries remain queued | Every matching delivery had `pending`; `transportEnabled` was false | Pass; delivery postconditions |
| Responsive report view | Completed report remains within a 390 × 844 viewport | Document width stayed within the mobile viewport | Pass; Chromium layout measurement |
| Browser stability | No uncaught runtime exception or error-level browser log entry | Zero captured errors | Pass; DevTools Runtime and Log events |
| Disposable cleanup | No synthetic installation remains | Chromium, web/API/PostgreSQL, networks and volumes were removed | Pass; cleanup output |

Six exploratory UI-delivery attempts preceded the clean run. The first exposed stale page state after switching from leader to Platform Manager in the same tab. A stricter navigation wait then rejected the application's legitimate root-to-overview hash initialization. Direct navigation, clicking the E-post navigation item, dispatching a hash-change event and forcing a new document URL still left stale organization content after the account transition. These attempts did not establish a product defect: the platform session and delivery API were correct, but the synthetic same-tab transition was not a reliable UI-evidence boundary. Each affected fixture was destroyed. The final run retained the platform API postconditions and does not claim that the E-post delivery page was visually verified.

This follow-up narrows E2E-01's remaining gaps but does not complete release acceptance. Classification, print/PDF headers, visible E-post delivery administration, real SMTP handoff/retry/mailbox receipt, keyboard/screen-reader behavior, multiple browser engines and approval by a separate actor remain outside this run. E2E-01 and roadmap gate 3 remain open until those controls and the rest of the maintained matrix have release-candidate evidence.
