# Interface examples

The screenshots in the [README](../../README.md) and [user manual](USER_MANUAL.md) show real Fylkren components with fictional English-language data. They illustrate the compact operational workspace, not customer records. The example uses an Operations Centre with Planning, Logistics and Communications teams and customer-configured exercise workflows. References, people, dates, counters and report text are synthetic. Navigation counters represent pending work across the user's authorized levels, rather than only the claimed assignment shown on a page.

| View | What the example demonstrates |
| --- | --- |
| [Overview](images/overview.png) | Summary counters, subordinate workload and annual statistics |
| [Tasks](images/tasks.png) | Compact rows, permanent references, deadlines, filters and status |
| [Planning](images/planning.png) | Claimed workflow with a timeline ruler and four dated milestones |
| [Execution](images/execution.png) | Responsibility, current workflow step, documentation and follow-up actions |
| [Reports](images/reports.png) | Year counts and title-based access to approved reports |
| [Final-report viewer](images/report-document.png) | Task reference, reporting unit, approval metadata and printable content |
| [Risk workspace](images/risk-workspace.png) | Numbered register, mitigations and connected before/after assessments |
| [Learning](images/learning-list.png) | Internal observations linked to assignments and their treatment queue |

## Reproduce the overview and workflow screenshots

Use Node 24, the repository's pnpm version, Docker and installed workspace dependencies. The preview is a development-only entry point; it is not part of the production application build. Its fetch fixture returns synthetic responses and rejects unexpected requests. It does not connect to a real API or authenticate a customer account. Use it for documentation capture, not as an operational sandbox.

Start Vite in one terminal:

```sh
pnpm --filter @fylkren/web dev --host 127.0.0.1 --port 19226
```

Start a disposable headless browser in another terminal:

```sh
docker run --rm -d --name fylkren-documentation-browser \
  --network host --shm-size=256m node:24-alpine sh -c \
  'apk add --no-cache chromium font-noto-emoji >/tmp/chromium-install.log 2>&1 && chromium --headless --no-sandbox --disable-gpu --disable-dev-shm-usage --remote-debugging-address=127.0.0.1 --remote-debugging-port=19224 --remote-allow-origins=* about:blank'
```

After Chromium starts, capture the five pages and the report viewer:

```sh
node tools/e2e/documentation-browser.mjs
```

The harness checks that the example data and timeline render, the report title opens its viewer, the document contains its reference, the pages have no horizontal overflow and the browser reports no runtime or resource errors. It writes six PNGs plus request evidence to the ignored `output/documentation-preview` directory. Inspect the pictures before copying the PNGs to `docs/administration/images`. The source fixtures are in `apps/web/test-fixtures/documentation-preview.jsx` and `documentation-data.js`; update them when the API response shape or page layout changes. The example year is fixed at 2026; update the dates when refreshing the documentation for a later year.

The risk and learning examples use their maintained fixtures and separate browser harnesses: `tools/e2e/risk-workspace-browser.mjs` and `tools/e2e/learning-browser.mjs`.

Stop the browser with `docker stop fylkren-documentation-browser` and stop Vite when finished. These screenshots validate presentation against synthetic data; they are not authentication, API integration or security-test evidence.
