# E2E-01 separate report approver - 2026-09-27

Run ID: `e2e-01-separate-report-approver-2026-09-27`. The application base was clean commit `96b90ab`; the maintained Chromium script (SHA-256 `e3a2cc4b597ef07f2316ca10b756fc08cd9246b42a969dd191bd55363ddfa901`) and local-actor helper (SHA-256 `491c8615689baa914853c6077e00b6637071e1a6b998d86c4cb12cb882e3c38e`) were the uncommitted test revision under verification. Chrome 151.0.7922.109 ran against freshly reset Community application, PostgreSQL and Data Protection volumes in the isolated `fylkren-browser-acceptance` Compose project.

The clean command was `node tools/e2e/community-browser-smoke.mjs --task-flow`. Administrative fixture setup created `Synthetic Report Author` and `Synthetic Report Approver` as distinct local identities with the leader role on the same top-level work context. Only the author received the separate Site Manager assignment needed by the existing site-audit check. The author registered, assessed, executed and wrote the classified final report through rendered controls. After save, the browser session was terminated and the approver signed in through the rendered login form before approval and completion.

| Control | Expected | Observed | Result / evidence |
| --- | --- | --- | --- |
| Distinct identities | Author and approver are separate people | Different local users, person IDs, usernames and display names were created | Pass; fixture assertions and session checks |
| Equivalent operational authority | Both actors may lead the same top-level work context | Both received the same protected leadership role; only the author received Site Manager separately | Pass; role-assignment responses |
| Authorship boundary | Saving the report records the signed-in author | Completed work stored `Synthetic Report Author` as `finalReportWrittenBy` | Pass; authenticated postcondition |
| Session boundary | Approval occurs only after a real account change | Author session was deleted; approver logged in through username/password form and session identity matched | Pass; rendered login and session assertion |
| Approval action | Separate leader can inspect and approve the saved report | Approver opened the task and `Godkjenn sluttrapport` became available | Pass; rendered task controls |
| Approval identity | Approval records the second actor | Completed work stored `Synthetic Report Approver` as `finalReportApprovedBy`, with approval timestamp | Pass; authenticated postcondition |
| Archive presentation | Formal report visibly distinguishes both actors | Report viewer rendered both author and approver display names with the classified content | Pass; DOM assertions |
| Adjacent regression | Account changes do not break the existing E2E-01 chain | All task, overview, workload, audit, notification and classification flags passed; zero browser errors | Pass; final JSON result |
| Disposable cleanup | No synthetic installation remains | Chromium, web/API/PostgreSQL, networks and volumes were removed | Pass; cleanup output |

An initial clean run established the two distinct stored identities. The archive assertion was then strengthened to require both names in the rendered report, and the complete scenario was repeated from empty volumes. Both runs passed; only the strengthened second run is the acceptance evidence.

This closes the separate-report-approver control for the automated E2E-01 subset. A multi-page local classified report, real SMTP handoff/retry/mailbox receipt, keyboard/screen-reader behavior and multiple browser engines remain outside this run. E2E-01 and roadmap gate 3 remain open.
