# Live Active Directory identity lifecycle — 2026-09-29

## Run identity

| Field | Value |
| --- | --- |
| Run ID | `live-active-directory-identity-2026-09-29` |
| Time | Final clean run completed 2026-09-29, 21:47 CEST |
| Product base revision | `8f4be28`, with the recorded identity changes in the subsequently committed revision |
| Product version | `0.70.0-dev.1` |
| Test command | `pnpm test:e2e:identity-ad` |
| Test program | `tools/run-identity-ad-lab.mjs` |
| Test-program SHA-256 | `081ef66d4620bfcdfd743bbdff82b739eb5cba0f08bb528d559f25575ce6b029` |
| Compose SHA-256 | `c580f41666afb54039f149ece97c47021371e55c55bf80f66304a8d0ca3d4939` |
| Entry-point SHA-256 | `5db3616d4ffec707e3b0ffb53573edf35b833efbe2127692dbcfe6540676e914` |
| Result | Passed from a clean topology |

## Environment and fixture

The maintained harness built the repository artifacts and started a fresh Fylkren installation, PostgreSQL and a pinned Samba Active Directory domain controller in `fylkren-identity-ad-lab`. The domain was provisioned for `EXAMPLE.TEST`; the API trusted the domain controller's generated CA and connected to `ad.example.test` over LDAPS with hostname verification. The fixture created one linked AD user and configured the provider through the protected Platform Manager API.

The lab image is a pinned third-party test dependency and the domain controller receives `SYS_ADMIN` only inside this disposable laboratory topology. It is not a production deployment component. Generated passwords were not logged or committed. The project and volumes were removed after the clean run.

## Observed results

| Control | Observed result | Result |
| --- | --- | --- |
| Transport and trust | Fylkren connected over LDAPS and validated the domain controller certificate name | Pass |
| Protected configuration | Connection test succeeded; the stored response reported a secret without returning its value | Pass |
| AD mapping | `sAMAccountName` lookup linked the binary `objectGUID` as a canonical GUID | Pass |
| Password authentication | The real AD password bind established a directory-managed Fylkren session | Pass |
| Authoritative suspension | Disabling the AD account through `samba-tool` suspended the link on synchronization | Pass |
| Session and sign-in rejection | The existing session became unauthenticated and a new sign-in returned `401` | Pass |
| Restoration | Re-enabling the AD account resumed the link and allowed a fresh sign-in | Pass |
| Account expiry | Setting `accountExpires` to the current day suspended the active link and revoked its existing session; `--noexpiry` resumed the same identity | Pass |
| Secret-safe logs | Generated AD bind and user passwords were absent from API logs | Pass |
| Directory outage | A stopped domain controller produced `unavailable` without incorrectly suspending the linked user | Pass |
| Cleanup | Containers, network and volumes were removed | Pass |

## Test-tool deviations retained

Initial laboratory attempts were not treated as product failures. A custom TLS override prevented Samba startup, the image entry point left a background process that exited, `/ntp_signd` lacked its required mode, and `samba-tool` initially selected the image's default database instead of the provisioned configuration. The deterministic test entry point corrected those issues. A first LDAPS attempt used a short alias and correctly failed hostname verification; the final run used the certificate name `ad.example.test`. Each partial topology was removed before the clean pass above.

## Exclusions and remaining gate

Active Directory enforces `objectGUID` uniqueness, so an ambiguous `objectGUID` fixture is not a valid AD state; the generic ambiguous stable-ID fail-safe is exercised in the OpenLDAP laboratory. This run did not test nested groups, multi-domain trusts, StartTLS, certificate rotation, external Windows Server AD or load, and it is not an independent penetration test. Those remain deployment/interoperability gates rather than missing AD lifecycle controls.
