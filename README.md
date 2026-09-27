<p align="center">
  <img src="assets/branding/fylkren-logo-web-256.png" width="112" alt="Fylkren logo">
</p>

# Fylkren

<p align="center"><strong>Operational task and mission management, from assignment to documented result.</strong></p>

<p align="center">Self-hosted · Source-available · Offline-first · One Community/Enterprise product</p>

Fylkren helps organizations receive, assess, plan, delegate, execute and report formal assignments across clear levels of responsibility. It is built for operational and preparedness work—including civil preparedness, emergency-response and public-sector organizations—and is also useful wherever work must be assigned, followed up and documented. These examples do not imply certification for safety-critical or classified use.

> **Pre-1.0 status:** Fylkren is being prepared for public release. The release acceptance and security verification are not complete. Do not treat this repository as a certified or production-approved system.

## The work chain

```text
Task or request → assessment → optional planning → execution → final report
                        │                   │                  │
                        └── delegation ────┴── status ────────┘
```

Each organizational level owns its work and writes its own final report. Leaders delegate and receive results without automatically editing subordinate processing. A site is an independent administration and access boundary; parent/child site relationships route work and reporting without merging permissions. Cross-site requests reveal an official response, not the receiver's internal casework.

## What Fylkren includes

| Operational work | Management and assurance | Integration and deployment |
| --- | --- | --- |
| Hierarchical tasks, internal delegation and cross-site requests | Level-specific workload and history | Local accounts, MFA and passkeys |
| Reusable planning and execution workflows, templates and timelines | Decisions, dependencies, risks and mitigations | Optional AD/LDAP, OIDC and SAML links |
| Final reports, approvals, PDF/print presentation and report archives | Audit trails and immutable approval versions | Versioned APIs, signed webhooks and portable site export |
| Rich text, document references and internal notifications | Site-managed roles and classification markings | Docker Compose, PostgreSQL and air-gapped operation |

Fylkren is not a document archive, general-purpose BPM/BI suite or formal security-classification system. Document references are links; Fylkren does not store the original files.

## Community and Enterprise

There is **one repository, codebase, database schema and upgrade path**. The API and web images are the same in both editions; there is no Enterprise fork or separate install. Community starts without an Enterprise entitlement file or Internet access. A valid offline signed entitlement activates selected Enterprise capabilities in that same installation.

| Community — ready without an entitlement file | Enterprise — enabled by offline entitlement |
| --- | --- |
| Up to 3 active sites (including child sites), unlimited internal units and people, local identity, MFA and passkeys | Additional active sites; new AD/LDAP, OIDC and SAML links and directory import |
| Tasks, planning, execution, reporting, templates and audit | Machine administration and report APIs |
| Notifications and portable customer-data export | Webhook subscriptions and delivery |
| Offline operation and the full customer-owned data model | Trusted independent-instance federation and signed cross-installation request routing |

Entitlements and the Community site limit are enforced by the API, not merely by hiding buttons. Removing or losing an Enterprise entitlement does not delete customer data or disable existing sites, even if there are more than three; only additional site creation or reactivation is blocked. Existing external identity links can still authenticate to avoid lockout. See the [edition and license architecture](docs/architecture/EDITION_ENTITLEMENTS.md) for the exact 1.0 allocation and transition rules.

To order and import an Enterprise license, including for fully air-gapped installations, follow the [license guide](docs/operations/GET_ENTERPRISE_LICENSE.md). Each independent installation has a stable Instance ID; a signed file activates its licensed capabilities without online activation.

## Start and explore

Once the repository is public, a new self-hosted test installation can use Docker Engine, Docker Compose v2 and Git:

```bash
git clone https://github.com/mfuryto/fylkren.git
cd fylkren
./deploy/compose/install.sh
docker compose up -d --build
docker compose ps
```

The installer creates a local `.env` with a random database password. Review the public URL, TLS/reverse-proxy settings, authentication and backup plan before exposing an installation. Complete the one-time Platform Manager setup in the browser, then verify `/health`. For upgrades, **back up PostgreSQL, `.env` and Data Protection keys first**; follow [installation and upgrades](docs/operations/INSTALLATION_AND_UPGRADES.md). For isolated networks, see [offline deployment](docs/operations/DEPLOYMENT_AND_OFFLINE.md).

Local development uses .NET 10, Node.js 24 and pnpm 11:

```bash
pnpm install
pnpm dev:web
pnpm dev:demo
dotnet run --project apps/api/Fylkren.Api.csproj
```

The read-only demo has no production API or persistence. The production client runs in a modern browser on Windows, Linux and macOS. Docker Compose is the supported single-node deployment model for the current product.

## Documentation

The [documentation portal](docs/README.md) is the maintained entry point. Useful starting places:

- [User manual](docs/administration/USER_MANUAL.md) and [task flow](docs/administration/WORKFLOW_AND_TASKS.md)
- [Federation administration](docs/administration/FEDERATION.md), [federation architecture](docs/architecture/INSTANCE_FEDERATION.md) and [independent review brief](docs/security/FEDERATION_SECURITY_REVIEW_BRIEF.md)
- [Technical architecture](docs/architecture/TECHNICAL_ARCHITECTURE.md) and [site model](docs/product/SITE_MODEL.md)
- [Administration API](docs/api/ADMINISTRATION_API.md), [Report API](docs/api/REPORT_API.md) and [webhooks](docs/api/WEBHOOKS.md)
- [Installation and upgrades](docs/operations/INSTALLATION_AND_UPGRADES.md), [system requirements](docs/operations/SYSTEM_REQUIREMENTS.md) and [security](SECURITY.md)
- [Roadmap](docs/project/ROADMAP.md), [decisions](docs/project/DECISIONS.md) and [changelog](CHANGELOG.md)

Repository-facing documentation is in English. Norwegian Bokmål is the current user-interface language; English UI localization is planned. API identifiers and permalinks are language-neutral.

## Issues, license and brand

GitHub Issues are intended for public bug reports, feature requests and product discussion once the repository opens. Please do not post credentials, customer information or security vulnerabilities in a public issue; follow [SECURITY.md](SECURITY.md). Pull requests are disabled; Fylkren does not accept external code contributions through GitHub.

Fylkren is **source-available under PolyForm Perimeter 1.0.0**. Use of the source is governed by the complete [LICENSE](LICENSE); software access and Enterprise feature entitlements are separate. Copyright © 2026 THUNOLD-OLSEN (Norwegian organization number 996871126); see [NOTICE.md](NOTICE.md). The Fylkren name and logo are addressed separately in [TRADEMARKS.md](TRADEMARKS.md). Third-party components retain their own terms; see [third-party notices](docs/project/THIRD_PARTY_NOTICES.md).
