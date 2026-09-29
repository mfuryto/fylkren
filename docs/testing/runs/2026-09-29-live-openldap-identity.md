# Live OpenLDAP identity lifecycle — 2026-09-29

## Run identity

| Field | Value |
| --- | --- |
| Run ID | `live-openldap-identity-2026-09-29` |
| Time | Completed 2026-09-29, 19:38 CEST |
| Product base revision | `9937766`, with the test harness in the subsequently committed revision |
| Product version | `0.70.0-dev.1` |
| Test command | `pnpm test:e2e:identity-directory` |
| Test program | `tools/run-identity-directory-lab.mjs` |
| Test-program SHA-256 | `fc5792b0424593c04738f0ade0871a5b4c339e2f1309c8d1113ed4ec2112e235` |
| Compose SHA-256 | `436f3ba21e5a01386c11a37c00a476deb5a094a7d5e42f64907eaf82007a0268` |
| Result | Passed from a clean topology |

## Environment and fixture

The maintained harness built the repository artifacts and started a fresh Fylkren installation, PostgreSQL and pinned OpenLDAP service in the isolated Compose project `fylkren-identity-directory-lab`. It created an ephemeral P-256 laboratory CA and LDAPS server certificate, mounted only the CA into the API trust store, and generated all directory and application passwords in memory. The synthetic directory contained one linked `inetOrgPerson` with `entryUUID` as its stable identifier and `employeeType=active` as its authoritative lifecycle rule.

The harness configured, connection-tested and enabled LDAP through the same protected Platform Manager API used by the GUI. The named project, volumes and ephemeral certificate directory were removed after the clean run.

## Observed results

| Control | Observed result | Result |
| --- | --- | --- |
| Transport and trust | Fylkren connected over LDAPS and validated the generated CA and `ldap` certificate name | Pass |
| Protected configuration | Connection test succeeded; the stored response reported a secret without returning its value | Pass |
| Stable linking | The external entry was linked to a distinct local anchor using its live `entryUUID` | Pass |
| Password authentication | The directory password bind established a Fylkren server session for the linked user | Pass |
| Authoritative suspension | Changing `employeeType` to `inactive` suspended the link on synchronization | Pass |
| Session and sign-in rejection | The existing session became unauthenticated and a new directory sign-in returned `401` | Pass |
| Restoration and profile synchronization | Returning the entry to active resumed access; a new sign-in exposed the updated display name | Pass |
| Directory outage | A stopped LDAP service produced `unavailable` without incorrectly suspending the linked user | Pass |
| Cleanup | Containers, network, volumes and ephemeral key material were removed | Pass |

## Test-tool deviations retained

Development of the harness exposed and corrected test-only command errors: an unsupported `ldapmodify` option, incorrect `docker compose exec` option ordering and a missing LDIF modification separator. An early fixture also linked the external identity to the Platform Manager instead of a separate site user; the final fixture uses a distinct local anchor. Each partial project was removed, and the table above represents the subsequent complete clean run.

## Exclusions and remaining gate

This run did not test deletion thresholds, ambiguous stable identifiers, malformed or duplicate attributes, directory unlinking, an external enterprise directory, StartTLS, certificate rotation, load, or the exact release-candidate revision. It is closed-laboratory evidence for part of E2E-14, not complete E2E-14 acceptance or an independent penetration test.
