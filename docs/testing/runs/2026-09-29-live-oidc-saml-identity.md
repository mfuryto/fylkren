# Live OIDC and SAML identity sign-in — 2026-09-29

## Run identity

| Field | Value |
| --- | --- |
| Run ID | `live-oidc-saml-identity-2026-09-29` |
| Time | Final clean run completed 2026-09-29, 20:31 CEST |
| Product base revision | `47e651c`, with the negative-test corrections in the subsequently committed revision |
| Product version | `0.70.0-dev.1` |
| Test command | `pnpm test:e2e:identity-sso` |
| Test program | `tools/run-identity-sso-lab.mjs` |
| Test-program SHA-256 | `5d0d08f54e11dded17154f73f4ab2bd1d5d050c349e34fd5983cef48dbf0f9b8` |
| Compose SHA-256 | `e1450c5bf6c1bf346d1c9773c44f0a6aa292b7bcbc30bfbbb602f09053a34d2f` |
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
| OIDC issuer binding | HTTPS metadata whose `issuer` differed from the configured authority was rejected by the provider connection test | Pass |
| OIDC callback binding | A forged `state` and a captured callback replay from a cookie-free browser both returned controlled `400`; neither left an authenticated session | Pass |
| Stable OIDC identity | The configured issuer and immutable `sub` resolved to the intended local anchor | Pass |
| Browser token boundary | The session used an HttpOnly server cookie; no token-named local/session storage keys existed | Pass |
| SAML metadata and signature | A real metadata-driven SAML login accepted the signed Keycloak assertion | Pass |
| SAML signature integrity | Altering the persistent NameID inside the signed assertion caused signature validation failure, controlled `400` and no session | Pass |
| SAML replay | Reposting the captured valid assertion from a cookie-free browser triggered token replay detection, controlled `400` and no session | Pass |
| Stable SAML identity | The persistent NameID resolved to the intended SAML anchor | Pass |
| SAML session boundary | The resulting Fylkren session was authenticated and its cookie was not readable by JavaScript | Pass |
| Cleanup | Containers, network, volumes and ephemeral key material were removed | Pass |

## Product findings and corrections

The first live SAML flow returned `500`: Sustainsys attempted to sign the outbound AuthnRequest although Fylkren does not configure an SP signing certificate. The application now explicitly sends unsigned AuthnRequests while continuing to require the identity provider's response/assertion signature validation. The clean run above passed after that correction. The corrected source SHA-256 before commit was `56e6ea90a51dd24cfbb79a619fcc682749effa5d143d9f72ada868d6cdfa60ec`.

`SV-050` found that the Platform Manager OIDC connection test accepted syntactically valid HTTPS discovery metadata without requiring its `issuer` to match the configured authority. A trusted endpoint serving metadata for a different issuer could therefore be approved. The test now requires exact canonical issuer binding and HTTPS authorization, token and JWKS endpoints. Mismatched metadata returns `502` and cannot satisfy activation's successful-test prerequisite.

`SV-051` found that a captured OIDC callback replay returned `400` but could still leave a local application session after the external handler failed. Remote OIDC failure handling now explicitly signs out any partial local session, returns a generic non-cacheable `400`, and records `external-authentication-rejected` without logging tokens or callback values. SAML validation and IdentityModel replay exceptions receive the same bounded response, sign-out and security event. The final clean run proved no authenticated session after any forged, tampered or replayed callback.

## Test-tool deviations retained

Harness bring-up also exposed test-only topology and expectation errors: inconsistent public hosts triggered the canonical-host defense, duplicate Chromium port flags prevented DevTools access, wildcard loopback redirects were rejected, direct manager calls used the wrong host, the initial persistent NameID did not match the prelinked value, and the test expected only `302` although the SAML middleware validly returned `303`. The first replay assertion also assumed an OIDC query callback although Keycloak used `form_post`; later partial runs inherited cookies across Chromium targets and could not distinguish a previous session from a failed assertion. The final harness captures either callback form, clears and verifies browser cookies before every attack, and asserts both the rejection response and unauthenticated session state. Each partial project was removed before the final clean run.

## Exclusions and remaining gate

This run did not execute a deliberately mismatched OIDC nonce, wrong-audience ID Token, unsigned SAML assertion, certificate rotation, IdP-initiated SAML, unlinking, logout propagation, external-provider or load tests. It therefore does not alone complete every identity requirement or final release acceptance.
