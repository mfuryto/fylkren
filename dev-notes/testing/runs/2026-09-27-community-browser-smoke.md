# Community browser smoke - 2026-09-27

Run ID: `community-browser-smoke-2026-09-27`. The application base was clean commit `2871208`; the maintained Chromium script (SHA-256 `969125bc4510cbdb2d37047b7be8b86b03cceabedbc3ac8f8b11da95b8a85390`) and this record were the uncommitted test revision under verification. A fresh Community installation used PostgreSQL 18 and a new Data Protection volume in the isolated `fylkren-browser-acceptance` Compose project. The built web/Nginx gateway and API were reached with Chrome 151.0.7922.109 from `chromedp/headless-shell:stable`, resolved to image digest `sha256:2d349b544a1ea6b5b5fd7c0fe99215ff662339c57407ee2e8c0a11af93516b04`.

The clean final browser command was `node tools/e2e/community-browser-smoke.mjs` against a DevTools endpoint supplied through `FYLKREN_BROWSER_CDP_URL` and the isolated internal target `http://web:8080/`. The test generated the Platform Manager credentials in memory, entered them through the rendered first-run form and never printed them. It exited zero with `communityBrowserSmoke: passed`. Chromium, the application containers, both networks and the database/key volumes were then removed.

| Control | Expected | Observed | Result / evidence |
| --- | --- | --- | --- |
| First-run presentation | Fresh database renders the one-time Platform Manager form | Heading, explanation and required fields rendered | Pass; DOM assertions |
| First-run submission | Valid synthetic details create the first Platform Manager and authenticated shell | Shell loaded with Platform navigation and Community label | Pass; UI form submission and DOM assertions |
| Desktop layout | Setup and authenticated shell do not overflow at 1,440 × 1,000 | Document width stayed within viewport | Pass; Chromium layout measurement |
| Site administration | Empty state is visible and the first Community site can be created through the UI | `Synthetic Browser Site` appeared; counter changed from 0/3 to 1/3 | Pass; modal form submission and DOM assertions |
| License presentation | Community state and offline signed-license import are explicit | Community, no active Enterprise rights and import control rendered | Pass; DOM assertions |
| Federation entitlement boundary | Existing federation state is readable, but new key/peer controls are unavailable in Community | Enterprise requirement rendered; create-key and add-peer controls absent | Pass; positive and negative DOM assertions |
| Mobile layout | License page does not create horizontal document overflow at 390 × 844 | Document width stayed within viewport | Pass; Chromium device metrics and layout measurement |
| Browser stability | No uncaught runtime exception or error-level browser log entry | Zero captured errors | Pass; DevTools Runtime and Log events |
| Disposable cleanup | No synthetic installation remains | Chromium, web/API/PostgreSQL, networks and volumes removed | Pass; cleanup output |

Three exploratory attempts preceded the clean result. The environment-provided interactive browser surface was unavailable and made no application request. The first headless container invocation overrode the image's internal DevTools forwarding port and closed the connection; it was stopped and restarted with image defaults. The next request correctly received HTTP 400 from canonical-host validation because Chromium used the isolated hostname `web:8080` while the API expected `localhost:18082`. The fixture was destroyed and recreated with `http://web:8080` as its isolated canonical origin; the complete clean run then passed. These were test-environment corrections, not product changes.

This smoke adds real rendered-browser evidence to the automated API baseline, but it is not the complete manual release-candidate acceptance matrix. It does not exercise operational leader workflows, keyboard/screen-reader accessibility, multiple browser engines, print/PDF, external identity, SMTP, Enterprise activation, live expiry, performance or independent security testing. Roadmap gate 3 remains open.
