# Live Enterprise license expiry — 2026-09-29

## Run identity

| Field | Value |
| --- | --- |
| Run ID | `live-enterprise-license-expiry-2026-09-29` |
| Time | 2026-09-29, 18:21–18:23 CEST |
| Product revision | `aec68d5` |
| Product version | `0.70.0-dev.1` |
| Test command | `pnpm test:e2e:license-expiry` |
| Test program | `tools/run-license-expiry.mjs` |
| Test-program SHA-256 | `6a97d92d2938fab3d272a63c873b842fa285996b77dd72edef5f62ad9e4e8837` |
| Result | Passed |

## Environment and fixture

The maintained harness built the repository artifacts and started the isolated Docker Compose project `fylkren-license-expiry-e2e` on loopback port `18087`. It used fresh PostgreSQL and Data Protection volumes, a disposable installation identity, a synthetic Platform Manager and synthetic sites. The named project and its volumes were removed after the run.

The harness generated a P-256 issuer key in process memory. The private key was neither written to disk nor logged. It signed a license with all maintained Enterprise entitlements and an expiry 25 seconds in the future. The test then observed the real wall clock; it did not alter the host or container clock. A second in-memory license was issued only to test recovery.

## Observed results

| Control | Expected | Observed | Result |
| --- | --- | --- | --- |
| Valid activation | The signed, instance-bound license activates Enterprise | Import returned a valid Enterprise state with all requested entitlements | Pass |
| Real-time expiry | Edition changes without process or container restart after `expiresAt` | The authenticated configuration changed from Enterprise to Community during polling after the actual clock transition | Pass |
| License status | Installed identity is retained, but status becomes expired | License status was `expired`, edition was Community, and the original license ID remained visible | Pass |
| Existing machine token | A token issued before expiry loses Enterprise access immediately | The previously successful administration request changed from `200` to `403` | Pass |
| Protected Enterprise mutations | New API clients, webhooks and external-identity configuration changes are rejected | Each protected mutation returned `403` after expiry | Pass |
| Federation boundary | Key rotation and inbound federated work are closed | Rotation and the federation ingress endpoint both returned `403` | Pass |
| Site capacity and retained data | Enterprise-created sites remain; Community cannot increase the active count beyond its quota | All four sites remained visible and usable as retained data; creation of a fifth returned `community_site_limit` | Pass |
| Protected configuration retention | Existing external-provider configuration remains stored without disclosing its secret | The OIDC record remained readable, reported `hasSecret: true`, and did not return the secret value | Pass |
| Background delivery gate | The webhook projection worker stops without deleting queued work | A controlled synthetic domain event remained unprojected for 12 seconds while the license was expired | Pass |
| Renewal | A valid replacement license restores eligible operations without restart | Existing machine access resumed, the retained webhook event was projected, and a new site could be created | Pass |
| Cleanup | Disposable services and data are removed | The named Compose project, network and volumes were removed by the harness | Pass |

The domain event was inserted directly into the disposable test database solely to obtain a deterministic observation of the background-worker entitlement gate. It contained no production or personal data.

## Test-tool deviation retained

The first invocation built and started healthy containers, then the harness failed before product assertions because its command helper called `.trim()` on a null `stdout` value while Compose inherited the terminal streams. The named test project and volumes were removed. The helper was corrected to handle inherited output, and the complete test was rerun from a clean topology. The result table above is from that clean successful run.

## Exclusions and remaining gate

This was not a production deployment test, browser-refresh test, live external-identity-provider sign-in, two-peer federation delivery, system-clock-skew or backward-clock test, or independent penetration test. MFA was disabled in the disposable fixture. The run did not use or expose the production license issuer, validate issuer-key custody, or establish final `v1.0.0` acceptance.

Repeat the maintained harness against the exact release-candidate revision. Production issuer/key-custody verification remains a separate release requirement.
