# Repository structure

This document describes the current repository rather than a proposed future scaffold.

```text
fylkren/
├── apps/
│   ├── api/              # .NET API, persistence and background services
│   ├── web/              # production React client
│   └── demo/             # static read-only demonstration client
├── assets/branding/      # default product assets
├── deploy/
│   ├── backup/           # backup and restore tooling
│   ├── compose/          # installation and server deployment files
│   └── offline/          # air-gapped update tooling
├── docs/
│   ├── administration/  # complete user, access and workflow manuals
│   ├── api/             # versioned integration contracts
│   ├── architecture/    # technical and repository design
│   ├── operations/      # install, upgrade, capacity and notifications
│   ├── product/         # product, domain, site and UI models
│   ├── project/         # roadmap, licensing and durable decisions
│   ├── security/        # policy detail, threat model and evidence
│   └── testing/         # acceptance scenarios and test guidance
├── shared/frontend/      # deliberately small shared frontend package
├── tools/                # repository, security and verification utilities
├── compose.yaml          # supported single-node deployment
├── Directory.Build.props
├── Directory.Packages.props
├── Fylkren.slnx
├── package.json
└── pnpm-workspace.yaml
```

## Ownership rules

- `apps/api` is the backend composition root. Feature folders own their endpoints, domain behavior and persistence configuration.
- `apps/web` is organized by feature. Shared behavior must have one named owner rather than being copied between pages.
- `apps/demo` is isolated from production APIs, persistence, credentials and production addresses.
- `shared` remains small. Domain-specific behavior belongs to the feature that owns it.
- `deploy` contains reproducible operational assets, not host-specific configuration or backups.
- `docs/README.md` is the only documentation index. README files elsewhere may explain only their local directory.
- Generated output, local credentials, environment files, databases, backups and workstation artifacts must never be tracked.

## Source-size guardrails

The repository structure check limits ordinary source files to 500 lines and stylesheets to 1,000 lines. Exceptions must be explicit, justified and temporary. Large endpoint, page or service files should be divided by behavior and ownership, not by arbitrary line ranges.

Run:

```bash
pnpm run check:structure
```

## Documentation ownership

`README.md` provides the concise product and developer entry point. Canonical operational, architectural and functional documentation is indexed from `docs/README.md`. `CHANGELOG.md` records released behavior changes; it must not become a parallel specification. Historical implementation notes should be removed once their durable decision or requirement has been captured in maintained documentation.

Repository-facing text is English. User-facing strings will be stored in localization resources during the internationalization phase and must not be coupled to routes, identifiers or API contracts.
