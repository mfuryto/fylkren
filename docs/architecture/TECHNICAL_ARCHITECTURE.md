# Technical architecture

## Architecture

Fylkren is a modular monolith: React/TypeScript clients call a .NET 10 REST API backed by PostgreSQL. Docker Compose is the supported single-node deployment model. This architecture keeps transactions, backup, upgrades and air-gapped operation manageable while preserving explicit feature ownership.

```text
Browser
  ↓ HTTPS / REST
ASP.NET Core API
  ├── Platform and identity
  ├── Organization and access
  ├── Work management and workflows
  ├── Reporting and notifications
  └── Audit and operations
  ↓ EF Core / Npgsql
PostgreSQL
```

See `DEVELOPMENT_STACK.md` for supported versions and tooling.

## Backend ownership

Feature folders own their endpoints, policies, services and persistence configuration. Shared infrastructure is limited to cross-cutting concerns such as authentication, antiforgery, request validation, error mapping, logging and database setup.

The server owns authorization, valid state transitions, audit context and persistence invariants. Clients may hide unavailable actions for usability but never provide the security boundary.

Feature code may use shared application services and explicit contracts. Repeated business rules must have one named owner rather than independent endpoint copies. Logical domain boundaries do not require a separate assembly for every small concept.

## Data and isolation

One PostgreSQL database stores platform and site data. Site-owned rows carry site identity, and query/authorization policies apply the site and organizational-level boundary before results are returned. Global IDs are cryptographically strong UUIDs; human-facing numbers and labels are separate.

Schema changes use ordered EF Core migrations. Production startup applies only versioned migrations and never resets data. Concurrency-sensitive aggregates use explicit conflict detection. Lists are bounded and paginated; high-use queries are indexed and avoid unbounded relationship loading.

## Authentication and authorization

ASP.NET Core authentication establishes one server-side browser session from local credentials, OIDC, SAML 2.0, Active Directory or LDAP. External stable identifiers are explicitly linked to a permanent person before access is granted.

Authorization combines platform role, active site membership, organizational placement, active role assignments and explicit delegated authority. Platform Manager and Site Manager are administrative roles, not automatic operational leaders. External directory groups do not become domain authority without explicit mapping.

Dedicated machine identities protect the versioned administration and report APIs. Machine credentials, browser sessions and their scopes are not interchangeable.

## Frontend

The production client is organized by feature and uses a small shared API/cache layer. Permalinks and route identifiers remain language-neutral. Site branding is resolved before branded content renders to avoid showing another site's appearance during loading.

The static demo has a separate composition root, synthetic fixtures and no production authentication, mutation code or API dependency. Presentation primitives may be shared only when that does not pull production behavior into the demo.

## Mutations, audit and background delivery

Business changes and their audit records are committed atomically when they belong to the same action. Audit is append-only through ordinary application behavior. Activity history, administrative audit and technical logs remain distinct.

Notification events are projected to a durable outbox-style delivery queue. SMTP failure does not roll back the business action. Retry state, terminal error and sanitized diagnostic reason are retained for Platform Manager visibility.

## Deployment and offline operation

The runtime contains three services:

```text
fylkren-web
fylkren-api
postgres
```

The web gateway is the only published entry point. API and database remain internal to the Compose network. Persistent database and Data Protection state, health checks and external configuration are mandatory.

No runtime feature may require external fonts, scripts, localization files, telemetry or internet lookup. Images and update bundles can be exported, verified and imported in an air-gapped environment. Dependencies and licenses are inventoried from locked build inputs.

## Verification

The quality gate includes clean release builds, frontend typecheck and tests, source-structure checks, migration inspection, repository secret/artifact scanning, container-image scanning and the maintained manual end-to-end matrix. Security verification follows OWASP ASVS 5.0 Level 2 with selected Level 3 requirements, OWASP WSTG and the OWASP API Security Top 10.

## Future scale

The present product targets a reliable single-node deployment. Multi-node API operation, database high availability and load balancing are not supported or on the committed roadmap. Implemented instance federation is a distinct, default-off Enterprise capability between independently operated installations, not a failover mechanism. See the [federation architecture](INSTANCE_FEDERATION.md) and [administration guide](../administration/FEDERATION.md).
