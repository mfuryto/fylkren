# GUI identity-provider settings - 2026-09-28

Run ID: `gui-identity-provider-settings-2026-09-28`. The implementation was
verified as an uncommitted revision based on commit `3d46023`. It moves Local,
AD, LDAP, OIDC and SAML provider configuration into Platform Manager's
**Identitet** page, protects stored configuration with the persistent Data
Protection key ring and imports existing environment configuration once.

| Control | Observed result | Result / evidence |
| --- | --- | --- |
| Community boundary | Local settings remained available; external provider mutation returned `403` | Pass; full local E2E assertions |
| Local lockout protection | Disabling local login without a tested external Platform Manager path returned `409` | Pass; full local E2E assertion |
| Provider activation gate | Activating the saved synthetic OIDC provider before a successful connection test returned `409` | Pass; full local E2E assertion |
| Protected secret | A synthetic OIDC client secret was stored, `hasSecret` became true, and neither the secret field nor serialized response disclosed it | Pass; full local E2E assertions |
| Runtime registration | Disabled OIDC and SAML handlers coexisted with normal requests; the API health check passed | Pass after correction; clean Compose rerun |
| Database migration | Fresh PostgreSQL 18 applied `20260928010000_AddGuiIdentityProviderSettings` and created protected provider rows | Pass; clean Compose run |
| API and web | API compiled with zero warnings/errors; typecheck, production web build and all 84 web tests passed | Pass |
| Full regression | All reported edition, workflow, authorization, API, webhook, portability and federation-candidate scenarios passed | Pass; `pnpm test:e2e:local`, exit zero |
| Cleanup | Test containers, networks and volumes were removed | Pass; suite cleanup output |

The first container attempt failed health validation because ASP.NET initializes
all remote request-handler schemes on ordinary requests: the disabled OIDC
scheme had no client ID, and the disabled SAML scheme lacked binding metadata.
The implementation was corrected to use non-routable, structurally valid
placeholder options only while a scheme is disabled. The option caches are
cleared when saved configuration is applied. The clean rerun above used the
corrected implementation; the failed attempt is retained here rather than
erased.

This run does not claim live-provider acceptance. Actual OIDC authorization,
SAML assertions, AD/LDAP binds and provider-specific metadata must still be
verified in the closed integration environment. The GUI performs bounded
connection/metadata tests, but those tests do not replace end-to-end validation
with the customer's identity provider.
