# Live OIDC and SAML identity sign-in — 2026-09-29

## Run identity

| Field | Value |
| --- | --- |
| Run ID | `live-oidc-saml-identity-2026-09-29` |
| Time | Completed 2026-09-29, 19:38 CEST |
| Product base revision | `9937766`, with the SAML correction and harness in the subsequently committed revision |
| Product version | `0.70.0-dev.1` |
| Test command | `pnpm test:e2e:identity-sso` |
| Test program | `tools/run-identity-sso-lab.mjs` |
| Test-program SHA-256 | `066852af849daf4acfbd36da9ef2629cb2ef98d11ce4b2bb763922e8cd27ce6e` |
| Compose SHA-256 | `1e1232e5cd4bea11f481f941251a92fe7a604d231adf680d7b9e59075554cec9` |
| Result | Passed from a clean topology |

## Environment and fixture

The maintained harness built the repository artifacts and started fresh Fylkren, PostgreSQL, Keycloak 26.3.3, TLS gateway and headless Chromium services in `fylkren-identity-sso-lab`. An ephemeral P-256 CA issued the Keycloak and gateway certificates. The API validated Keycloak metadata over HTTPS with that CA. Chromium used the closed laboratory's self-signed TLS endpoints so `Secure`/`SameSite=None` callback-cookie behavior was exercised; browser certificate-chain validation was not claimed.

OIDC used a confidential client, authorization-code flow and pushed authorization requests. SAML used live metadata, a signed assertion and a deterministic persistent NameID. Client secrets and synthetic passwords were generated for the run and were neither recorded here nor committed.

## Observed results

| Control | Observed result | Result |
| --- | --- | --- |
| OIDC metadata | The provider connection test retrieved live discovery metadata over trusted HTTPS | Pass |
| Client-secret protection | The stored provider reported `hasSecret: true` without returning the client secret | Pass |
| OIDC browser flow | A real authorization-code login completed through Keycloak and the callback | Pass |
| Stable OIDC identity | The configured issuer and immutable `sub` resolved to the intended local anchor | Pass |
| Browser token boundary | The session used an HttpOnly server cookie; no token-named local/session storage keys existed | Pass |
| SAML metadata and signature | A real metadata-driven SAML login accepted the signed Keycloak assertion | Pass |
| Stable SAML identity | The persistent NameID resolved to the intended SAML anchor | Pass |
| SAML session boundary | The resulting Fylkren session was authenticated and its cookie was not readable by JavaScript | Pass |
| Cleanup | Containers, network, volumes and ephemeral key material were removed | Pass |

## Product finding and correction

The first live SAML flow returned `500`: Sustainsys attempted to sign the outbound AuthnRequest although Fylkren does not configure an SP signing certificate. The application now explicitly sends unsigned AuthnRequests while continuing to require the identity provider's response/assertion signature validation. The clean run above passed after that correction. The corrected source SHA-256 before commit was `56e6ea90a51dd24cfbb79a619fcc682749effa5d143d9f72ada868d6cdfa60ec`.

## Test-tool deviations retained

Harness bring-up also exposed test-only topology and expectation errors: inconsistent public hosts triggered the canonical-host defense, duplicate Chromium port flags prevented DevTools access, wildcard loopback redirects were rejected, direct manager calls used the wrong host, the initial persistent NameID did not match the prelinked value, and the test expected only `302` although the SAML middleware validly returned `303`. The laboratory was changed to one canonical TLS origin, exact callbacks and a deterministic persistent NameID. Each partial project was removed before the final clean run.

## Exclusions and remaining gate

This run did not execute forged-state, nonce-replay, wrong-audience, wrong-issuer, unsigned/tampered assertion, certificate-rotation, IdP-initiated SAML, unlinking, logout propagation, external-provider or load tests. It therefore supports, but does not alone complete, the relevant ASVS 10 requirements or final release acceptance.
