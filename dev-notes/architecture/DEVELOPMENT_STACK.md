# Development stack

The lockfiles and build configuration are authoritative for exact versions. This document defines supported version lines and engineering policy.

## Runtime and frameworks

| Area | Choice | Supported line |
| --- | --- | ---: |
| Backend runtime and API | .NET / ASP.NET Core | 10 LTS |
| Data access | Entity Framework Core | 10.x |
| PostgreSQL provider | Npgsql EF Core | compatible 10.x |
| Frontend runtime | Node.js | 24 LTS |
| UI | React | 19.2.x |
| Language | TypeScript | 5.x, strict mode |
| Build tool | Vite | 8.x |
| Package manager | pnpm | 11.x |

Node.js is needed for development and static builds, not in the final web runtime image.

## Backend policy

- The target framework is `net10.0`.
- ASP.NET Core route groups are organized by feature. Do not maintain parallel endpoint patterns without a concrete reason.
- EF Core uses explicit, versioned migrations against PostgreSQL.
- Integration tests use PostgreSQL semantics; SQLite and EF InMemory are not substitutes for database integration tests.
- Authorization, state transitions, validation and audit behavior remain server-owned.
- The OpenAPI description is a reviewed and testable contract.

## Frontend policy

- React function components and strict TypeScript are the default.
- Browser `fetch` is wrapped by the small shared API layer; avoid parallel general-purpose HTTP clients.
- The server is authoritative for validation and access control.
- Design tokens use CSS custom properties and support controlled white-label configuration.
- Product components own Fylkren's public UI behavior even when selected third-party primitives are used internally.
- Accessibility, keyboard operation, responsive layout and reduced motion are acceptance criteria.
- Routes and persistent identifiers remain language-neutral.

## Demo application

The demo uses the same React, TypeScript and Vite lines but remains a separate static, read-only composition root. It contains only synthetic fixtures and must not include production API clients, authentication packages, mutation commands, secrets, production addresses or persistent operational data.

## Verification tools

| Level | Tooling |
| --- | --- |
| Backend unit and integration | .NET test projects, `WebApplicationFactory` and PostgreSQL containers where required |
| Frontend unit/component | Vitest and Testing Library |
| End-to-end | Playwright and the maintained scenario matrix |
| Contract | Generated OpenAPI with explicit review |
| Quality | TypeScript typecheck, production builds, source-structure gate and repository safety scripts |

Test dependencies must be compatible with the distribution model. Paid or source-restricting additions require a separate decision.

## Reproducibility and upgrades

- `global.json`, central NuGet package management, `packageManager` and `pnpm-lock.yaml` pin the supported toolchain.
- Runtime images are pinned to controlled version lines and updated through a documented process.
- Security and patch updates are evaluated continuously and verified by tests.
- Major upgrades require an explicit decision and migration note.
- Backend, EF Core and Npgsql major versions remain compatible.
- Demo and production frontend use the same major frontend versions.
- Runtime assets, fonts and dependencies must not depend on a CDN or internet lookup.

## Not selected

- microservices, a message broker or Kubernetes without a demonstrated requirement;
- an additional global state library before a concrete need exists;
- GraphQL as a parallel API;
- a component catalogue as a separate product;
- uncontrolled automatic dependency upgrades.
