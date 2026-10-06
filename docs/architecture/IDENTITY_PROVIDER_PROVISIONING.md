# Identity-provider provisioning

This document is the canonical requirement, implementation and test traceability reference for OIDC/SAML person provisioning. The operational identity model and administrator procedure remain in [Access and identity](../administration/ACCESS_AND_IDENTITY.md).

## Requirements

| ID | Requirement |
| --- | --- |
| IDP-01 | Platform Manager can independently enable automatic first-sign-in provisioning for OIDC and SAML. The default is disabled. |
| IDP-02 | A verified unknown `(provider, provider instance, stable subject)` creates exactly one internal person, login identity and namespaced external link. AD/LDAP direct addition and every existing explicit-link path remain compatible. |
| IDP-03 | Email, username and display-name similarity never links or merges people. A username/email collision fails closed and creates a visible Platform Manager review item. An explicit stable-identifier link resolves that item. |
| IDP-04 | Provider-owned stable ID, username, display name and email are read-only in Fylkren. Site membership, placement, roles, permissions and local access state remain Fylkren-owned. |
| IDP-05 | A newly provisioned person without local access receives an authenticated pending session and a clear information page. Every ordinary operational, Site and administrative API remains denied. Session inspection, antiforgery acquisition and sign-out are the only pending-session exceptions. |
| IDP-06 | Platform Manager can find the pending person in the global directory and assign a Site. Ordinary access policy then applies; the receiving Site Manager uses existing placement and role controls. |
| IDP-07 | Creation is transactionally race-safe, uses immutable provider namespaces and records system-attributed security audit evidence. Deactivated links fail closed and require explicit administrative relinking. |
| IDP-08 | No provider token, secret or unbounded claim is persisted. Existing OIDC/SAML validation, session, MFA, entitlement and federation/API contracts remain unchanged. |

## Architecture and data model

Domain state remains authoritative. This capability does not add event sourcing, a message broker or a second audit mechanism.

- `ExternalIdentityLink.ProvisionedAt` distinguishes provider-created OIDC/SAML people from explicitly linked locally managed people. Existing links remain locally managed and compatible.
- `ExternalIdentityProvisioningIssue` stores only the provider namespace, stable subject, bounded identity attributes, reason and first/last/resolved timestamps. Its unique provider/instance/subject index makes it one durable review item rather than a repeated notification stream.
- `ExternalIdentityProvisioningService` resolves an exact active link first. Unknown identities are created only when that provider's switch is enabled. A PostgreSQL transaction-scoped advisory lock serializes concurrent first sign-ins for the same namespaced subject; database uniqueness remains the final invariant.
- The generated internal username is deterministic when the provider does not supply a value that fits the internal username contract. It is not a cross-provider linking key.
- OIDC and SAML handlers create the same browser-session record as before. The cookie contains `fylkren:access_granted=false` until the person has active local access. The default and fallback authorization policy require `access_granted=true`.
- `/api/session` reports `accessPending`; the web application avoids private configuration and operational requests while pending. The two pending-session mutation helpers are covered by the explicitly named authentication-only policy.
- Platform Manager's existing global-user assignment endpoint activates the ordinary Site membership path. No provisioning-only role or parallel access model exists.
- Provider-created people are treated as provider managed by existing profile/password guards. Profile image remains locally editable after ordinary access is assigned.

Migration `20261006223000_AddExternalIdentityProvisioning` adds the nullable provenance column and review table. Existing links receive no invented provisioning provenance, so upgrades preserve their current behavior. The migration enables no deletion, anonymisation or retention execution.

## Security considerations

Provider signature, issuer/entity, audience, nonce/state, replay, freshness, metadata transport and RSA-strength controls run before provisioning. Stable identifiers are always scoped by provider and canonical issuer/IdP entity. Claim collisions cannot grant access or select an existing person. Pending cookies identify one authenticated person but cannot satisfy the default API policy. Provisioning and review-required events use the existing security audit store with system attribution; administrator linking retains the existing actor audit.

The review record deliberately excludes tokens, assertions, secrets and arbitrary claim payloads. Username, display name and email are trimmed, control-character checked and length bounded; email is parsed before storage. Site assignment remains an explicit authorized Platform Manager decision.

## Delivery and test traceability

| Requirements | Implementation | Verification |
| --- | --- | --- |
| IDP-01, IDP-02, IDP-07 | Provider settings, OIDC/SAML handlers, provisioning service, advisory lock, unique link index and system audit | `ExternalIdentityProvisioningTests`: disabled/enabled OIDC and SAML, repeat resolution and concurrent first sign-ins; `run-identity-sso-lab.mjs`: live signed OIDC creation |
| IDP-03 | Collision detection, provisioning review table/API/UI and explicit-link resolution | `ExternalIdentityProvisioningTests`: username/email collision and review lifecycle; live lab: unlink, review visibility and explicit relink |
| IDP-04 | Provisioning provenance plus existing profile/password guards and provider-managed UI | Database test verifies provider-owned updates versus explicitly linked local people; live lab receives HTTP 409 for local profile mutation |
| IDP-05 | Access claim, default/fallback authorization policy, pending session response and pending page | Authorization-policy test proves default denial/authentication-only exception; live lab proves pending session and HTTP 403 from an ordinary API |
| IDP-06 | Global directory pending marker and existing bulk Site assignment | Live lab finds the pending person, assigns a Site, observes `accessPending=false` and receives HTTP 200 from the ordinary profile API |
| IDP-02, IDP-07 | Explicit links retain local ownership; provider namespace includes exact issuer/entity; inactive links reject | Database test covers an LDAP-linked person with an additional explicit SAML link, different-issuer subject separation and inactive-link review; maintained AD/LDAP and OIDC/SAML laboratories retain their existing direct-add/link tests |
| IDP-08 | Bounded claim normalization, existing provider validation and common session/audit mechanisms | API/foundation builds, EF model-diff check, web typecheck and the complete maintained OIDC/SAML laboratory |

The focused database command is `node tools/run-foundation-tests.mjs --external-identity-provisioning-only`. The live provider command is `node tools/run-identity-sso-lab.mjs`. Candidate-wide regression and deployment qualification remain the next release gate; these focused results do not substitute for it.
