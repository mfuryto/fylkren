# E2E-01 workload and classification defaults - 2026-09-27

Run ID: `e2e-01-workload-classification-2026-09-27`. The application base was clean commit `1aeeaa7`; the maintained Chromium script (SHA-256 `b658523ee057df9e6c6cf0d33e41100d756e3d31da92fcfe868b03a923bb2aa8`), workload helper (SHA-256 `8e6940c6b764bf7a2e846e9a08de3d4c140a287b14dbdf654a9cd3f100746494`) and classification helper (SHA-256 `10e18b2ccac987b741de20efd12eb16e8285c65e67f799b332644c768502119e`) were the uncommitted revision under verification. The API and web images were rebuilt before a fresh Community installation with PostgreSQL 18 and new database/Data Protection volumes in the isolated `fylkren-browser-acceptance` Compose project.

The clean command was `node tools/e2e/community-browser-smoke.mjs --task-flow --classified-pdf`. The active top-level task and its completed state were each checked through the authenticated workload-history API and the rendered 12-month SVG. The same fresh migration presented the standard classification dropdown as `PUBLIC`, `INTERNAL`, `CONFIDENTIAL`, `SENSITIVE`, `SECRET`, in ascending order and without `UNCLASSIFIED`.

| Control | Expected | Observed | Result / evidence |
| --- | --- | --- | --- |
| Active workload data | One active leaf task is represented once | Latest of 12 API points had `total: 1` | Pass; authenticated workload-history assertion |
| Active workload chart | Rendered total series reflects one active task | `Entire site` line ended at SVG y=40 on a scale whose maximum was one | Pass; rendered polyline assertion |
| Completed workload data | Completed work leaves current active workload | Latest API point changed to `total: 0` | Pass; authenticated postcondition |
| Completed workload chart | Rendered total series returns to zero | `Entire site` line ended at SVG y=250 | Pass; rendered polyline assertion |
| Chart semantics | History is identifiable and spans the required period | Accessible label, availability date, 12 month labels and `Entire site` legend rendered | Pass; DOM assertions |
| Chart layout | Both states fit the desktop viewport | No horizontal document overflow at either total | Pass; Chromium layout measurement |
| Default classification order | Fresh installations use ordinary English terms in ascending order | `PUBLIC (PUB)`, `INTERNAL (INT)`, `CONFIDENTIAL (CONF)`, `SENSITIVE (SENS)`, `SECRET (SECRET)` rendered in exact order after `No classification` | Pass; complete select-option assertion |
| No unclassified default | `UNCLASSIFIED` is not seeded | No such option appeared | Pass; exact option-list assertion |
| Adjacent E2E-01 regression | Existing direct-execution controls remain green | All chain, overview, audit, notification, classification and PDF flags passed; zero browser errors | Pass; final JSON result |
| Disposable cleanup | No synthetic installation remains | Chromium, web/API/PostgreSQL, networks, volumes and PNG intermediates were removed | Pass; cleanup output |

The first .NET preflight attempted to create an SDK sentinel in a read-only home directory. It was rerun successfully with `DOTNET_CLI_HOME` under `/tmp`; this was an environment-only deviation before the acceptance fixture. The workload assertions themselves passed on every fresh run. PDF-specific exploratory deviations and the refreshed `CONFIDENTIAL` artifact are recorded in the [classified PDF follow-up](2026-09-27-e2e-01-classified-report-pdf.md).

This closes the top-level workload-presentation control for the automated E2E-01 subset. Recursive subordinate workload, multi-child fan-out, real SMTP handoff/retry/mailbox receipt, keyboard/screen-reader behavior, multiple browser engines and approval by a separate actor remain outside this run. E2E-01 and roadmap gate 3 remain open.
