# Anonymous configuration boundary — 2026-09-24

## Scope

The deployed 0.69.0 `GET /api/configuration/public` response exposed the exact version, edition, Enterprise entitlement IDs, Community site limit and active classification labels to unauthenticated callers. The response held no credentials, but this metadata was unnecessary for the sign-in page and aided installation fingerprinting. The 0.69.1 change narrowed the anonymous response to presentation defaults, setup state and configured sign-in methods. Presentation defaults now include language, time zone, clock format and measurement system. The detailed response remains authenticated at `GET /api/configuration`.

The anonymous endpoint remains reachable from remote browsers. Binding it to 127.0.0.1 would break normal browser login; the loopback binding belongs to the API deployment behind its reverse proxy, while authentication and response minimization protect this application endpoint.

## Verification

| Check | Result |
| --- | --- |
| API build, warnings treated as errors | Passed: 0 warnings, 0 errors. |
| Web build | Passed. |
| Web unit tests | Passed: 25 files, 78 tests. |
| Isolated Docker E2E | Passed: all existing edition, task, site, authorization and federation-candidate assertions. |
| Anonymous configuration | E2E asserted absence of `version`, `edition`, `entitlements` and `classificationMarkings`. The loopback test instance returned only sign-in essentials. |
| Detailed configuration without session | E2E asserted HTTP 401. |
| Edition transitions with session | E2E asserted Community and Enterprise state through authenticated configuration. |
| Cleanup | The test Compose project and its temporary database/key volumes were removed by the runner. |

The manual public-surface script now checks this boundary during future deployment checks. This is a targeted information-disclosure fix, not a complete security-verification or penetration-test result.
