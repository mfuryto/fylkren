# Demo and proof of concept

## Purpose

Fylkren includes a separately built public demonstration application for design validation and product evaluation with synthetic data. It is not a restricted production installation; it is a static read-only artifact with its own composition root and publication rules.

## Mandatory boundary

The demo contains:

- static UI assets and bundled synthetic fixtures only;
- no backend, database, login or real user accounts;
- no production API client, mutation command or write route;
- no forms that transmit user content;
- no durable local storage of operational content;
- a permanent `Demo — sample data only` indication.

Filtering, search, sorting, tabs and detail expansion may operate in browser memory. Reloading restores the versioned fixture state.

Read-only behavior is established by excluding write dependencies from the build, not merely by hiding buttons. Unknown or editing routes return a read-only not-found experience.

## Fixtures

Fixtures are versioned JSON or TypeScript source data. They must be wholly synthetic, stable enough for visual tests and representative of sites, units, roles, task statuses, planning, execution, reports and timelines. They must never be copied from production or include credentials, internal addresses, personal data or genuinely classified material.

## Security

URL, fragment and query input is untrusted. Dynamic code evaluation and uncontrolled HTML insertion are prohibited. The published demo uses a strict Content Security Policy where the host supports it and has:

- no runtime CDN, third-party font, analytics or tracker;
- no `eval` or inline-script exception;
- no network calls to a production API;
- no background-sync service worker;
- no upload, clipboard import or free-text persistence;
- locked and scanned dependencies.

Absence of a backend reduces impact but does not replace ordinary frontend security.

## Build and publication

The demo produces static HTML, CSS, JavaScript, localization resources and fixture data and supports a configurable base path. A publication workflow must install locked dependencies, run tests and security checks, build only the demo, scan the artifact for production addresses/secrets/write dependencies and publish the static result to an approved target.

Public publication is activated only through an explicit release decision.

## Acceptance criteria

- No application network calls occur after static assets load.
- No action transmits or persists user content.
- The demo works without API and database services.
- Static hosting under a subdirectory works.
- All people, tasks and events are visibly synthetic.
- The demo banner remains visible on every route.
- Production write and administration routes are absent from the bundle.
- Automated verification fails if a mutation dependency or forbidden network address enters the demo.

The demo is not used to verify backend security, authorization, migration, performance or restore behavior. Those require the full integration environment.
