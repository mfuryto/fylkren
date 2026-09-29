# Live OpenLDAP identity lifecycle — 2026-09-29

## Run identity

| Field | Value |
| --- | --- |
| Run ID | `live-openldap-identity-2026-09-29` |
| Time | Final clean run completed 2026-09-29, 22:06 CEST |
| Product base revision | `8f4be28`, with the recorded identity changes in the subsequently committed revision |
| Product version | `0.70.0-dev.1` |
| Test command | `pnpm test:e2e:identity-directory` |
| Test program | `tools/run-identity-directory-lab.mjs` |
| Test-program SHA-256 | `49eca8cfc647937b9a251cb6dadf9e1dc53ed5d45828f0873cce8a241de6011e` |
| Compose SHA-256 | `e6ba936b577515f7e35ba93d11181101b826614634ac5067a93071da284d2fa8` |
| Result | Passed from a clean topology |

## Environment and fixture

The maintained harness built the repository artifacts and started a fresh Fylkren installation, PostgreSQL and pinned OpenLDAP service in the isolated Compose project `fylkren-identity-directory-lab`. It created an ephemeral P-256 laboratory CA and LDAPS server certificate, mounted only the CA into the API trust store, and generated all directory and application passwords in memory. The synthetic directory used customer-configurable `employeeNumber` as its stable identifier and `employeeType=active` as its authoritative lifecycle rule; no product-defined classification or identity values were assumed.

The harness configured, connection-tested and enabled LDAP through the same protected Platform Manager API used by the GUI. The named project, volumes and ephemeral certificate directory were removed after the clean run.

## Observed results

| Control | Observed result | Result |
| --- | --- | --- |
| Transport and trust | Fylkren connected over LDAPS and validated the generated CA and `ldap` certificate name | Pass |
| Protected configuration | Connection test succeeded; the stored response reported a secret without returning its value | Pass |
| One-time migration | Existing environment settings were imported on first start; recreating the API with a changed environment server did not overwrite the database/GUI setting | Pass |
| Stable linking | The external entry was linked to a distinct local anchor using its configured `employeeNumber` | Pass |
| LDAP injection | Filter metacharacters submitted through sign-in and linking were escaped and treated as literal data | Pass |
| Password authentication | The directory password bind established a Fylkren server session for the linked user | Pass |
| Scheduled and manual synchronization | The background worker populated last-check state and all explicit lifecycle transitions were also exercised manually | Pass |
| Authoritative suspension | Changing `employeeType` to `inactive` suspended the link on synchronization | Pass |
| Session and sign-in rejection | The existing session became unauthenticated and a new directory sign-in returned `401` | Pass |
| Restoration and profile synchronization | Returning the entry to active resumed access; a new sign-in exposed the updated display name | Pass |
| Ambiguous and malformed data | A duplicate stable ID and an overlong display name produced `unavailable` without suspension | Pass |
| Invalid bind | External lookup-account password rotation produced `unavailable` without suspension; restoring it returned the link to active | Pass |
| Confirmed missing account | Moving the entry outside the search base remained pending for checks one and two, suspended on check three and revoked the session | Pass |
| Unlink and relink | Removal denied directory login; relinking reactivated the same link and retained person ID and site membership | Pass |
| Audit and secret boundary | Suspend/resume events used actor `directory-lifecycle`; link/unlink events existed; generated bind and user passwords were absent from API logs | Pass |
| Directory outage | A stopped LDAP service produced `unavailable` without incorrectly suspending the linked user | Pass |
| Cleanup | Containers, network, volumes and ephemeral key material were removed | Pass |

## Test-tool deviations retained

Development of the harness exposed and corrected test-only command errors: an unsupported `ldapmodify` option, incorrect `docker compose exec` option ordering and a missing LDIF modification separator. An early fixture also linked the external identity to the Platform Manager instead of a separate site user; the final fixture uses a distinct local anchor. Each partial project was removed, and the table above represents the subsequent complete clean run.

## Exclusions and remaining gate

This run did not use an external enterprise directory, StartTLS, certificate rotation or load, and it is not an independent penetration test. Those are deployment/interoperability gates; the maintained OpenLDAP functional and negative E2E-14 scope passed.
