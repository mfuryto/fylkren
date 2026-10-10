# Live OIDC and SAML identity sign-in — 2026-09-29

## Run identity

| Field | Value |
| --- | --- |
| Run ID | `live-oidc-saml-identity-2026-09-29` |
| Time | Final clean run completed 2026-09-29, 22:25 CEST |
| Product base revision | `8f4be28`, with the recorded identity changes in the subsequently committed revision |
| Product version | `0.70.0-dev.1` |
| Test command | `pnpm test:e2e:identity-sso` |
| Test program | `tools/run-identity-sso-lab.mjs` |
| Test-program SHA-256 | `fcbbf5d29270b4dfbc68f8baba28da6e411e73e9ff1ca290aedcc93cd003bc95` |
| Compose SHA-256 | `0cb4f2001624d8c8bb6be7ad5a145b4d5ae25cae671852776c8d1f959919e9ea` |
| Negative-provider SHA-256 | `c5625b6e944c568132d0c79f7dc4d20ac7773bfecebf8cc401e2e8571fdc127b` |
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
| OIDC nonce and audience | Correctly signed tokens carrying a wrong nonce or wrong audience were rejected with controlled `400` and no session | Pass |
| Stable OIDC identity | The exact configured issuer and immutable `sub` resolved to the intended local anchor; a colliding subject from a second issuer did not | Pass |
| OIDC unlink/relink | Removal blocked login and relinking restored the exact issuer-bound identity | Pass |
| Direct SSO and lockout safety | Normal navigation redirected to OIDC, `/?local=1` retained local presentation, provider disable cancelled redirect, unsafe final manager unlink was blocked | Pass |
| Browser token boundary | The session used an HttpOnly server cookie; no token-named local/session storage keys existed | Pass |
| SAML metadata and signature | A real metadata-driven SAML login accepted the signed Keycloak assertion | Pass |
| SAML signature integrity | Altering the persistent NameID inside the signed assertion caused signature validation failure, controlled `400` and no session | Pass |
| Unsigned SAML | Removing every XML signature from a fresh response caused controlled `400` and no session | Pass |
| SAML replay | Reposting the captured valid assertion from a cookie-free browser triggered token replay detection, controlled `400` and no session | Pass |
| Stable SAML identity | The exact IdP Entity ID and persistent NameID resolved to the intended SAML anchor | Pass |
| SAML unlink/relink | Removal and reactivation preserved the exact provider-bound identity | Pass |
| SAML session boundary | The resulting Fylkren session was authenticated and its cookie was not readable by JavaScript | Pass |
| Cleanup | Containers, network, volumes and ephemeral key material were removed | Pass |

## Product findings and corrections

The first live SAML flow returned `500`: Sustainsys attempted to sign the outbound AuthnRequest although Fylkren does not configure an SP signing certificate. The application now explicitly sends unsigned AuthnRequests while continuing to require the identity provider's response/assertion signature validation. The clean run above passed after that correction. The corrected source SHA-256 before commit was `56e6ea90a51dd24cfbb79a619fcc682749effa5d143d9f72ada868d6cdfa60ec`.

`SV-050` found that the Platform Manager OIDC connection test accepted syntactically valid HTTPS discovery metadata without requiring its `issuer` to match the configured authority. A trusted endpoint serving metadata for a different issuer could therefore be approved. The test now requires exact canonical issuer binding and HTTPS authorization, token and JWKS endpoints. Mismatched metadata returns `502` and cannot satisfy activation's successful-test prerequisite.

`SV-051` found that a captured OIDC callback replay returned `400` but could still leave a local application session after the external handler failed. Remote OIDC failure handling now explicitly signs out any partial local session, returns a generic non-cacheable `400`, and records `external-authentication-rejected` without logging tokens or callback values. SAML validation and IdentityModel replay exceptions receive the same bounded response, sign-out and security event. The final clean run proved no authenticated session after any forged, tampered or replayed callback.

`SV-052` was exposed only after provider switches and unlink/relink expanded the sequence: a late remote-handler failure could still leave a chunked application cookie even though the callback returned `400`. A final callback-boundary middleware now uses the configured cookie manager to delete the application cookie whenever an OIDC or SAML callback completes with an error. The clean run proved atomic rejection across forged state, replay, wrong nonce/audience and unsigned/tampered SAML cases.

## Test-tool deviations retained

Harness bring-up also exposed test-only topology and expectation errors: inconsistent public hosts triggered the canonical-host defense, duplicate Chromium port flags prevented DevTools access, wildcard loopback redirects were rejected, direct manager calls used the wrong host, the initial persistent NameID did not match the prelinked value, and the test expected only `302` although the SAML middleware validly returned `303`. The first replay assertion also assumed an OIDC query callback although Keycloak used `form_post`; later partial runs inherited cookies across Chromium targets and could not distinguish a previous session from a failed assertion. The final harness captures either callback form, clears and verifies browser cookies before every attack, and asserts both the rejection response and unauthenticated session state. Each partial project was removed before the final clean run.

## Exclusions and remaining gate

This run did not execute certificate rotation, IdP-initiated SAML, upstream logout propagation, external customer-provider interoperability or load tests. Those remain deployment/interoperability gates and the run does not replace independent penetration testing.
