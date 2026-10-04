# Access and identity

Local accounts, MFA and WebAuthn/passkeys are Community capabilities. New AD/LDAP, OIDC and SAML identity links and AD/LDAP personnel import require the Enterprise `external-identity` entitlement. If the entitlement expires or is removed, existing linked users can still authenticate and access their authorized data; new linking and import are blocked. See [edition entitlements](../architecture/EDITION_ENTITLEMENTS.md).

The access model is verified end to end against `ACCESS_MATRIX.md`. Person, login identity, site membership, organizational placement and role assignment are separate concepts.

## Person and account

A permanent internal person ID owns historical attribution. One person may have local, Active Directory, LDAP, OIDC or SAML login identities without creating a new historical actor. A normalized primary email address is globally unique and may be used for local login and as a verified mapping candidate; the provider's stable identifier remains the durable external key.

Username and email share one global normalized namespace. PostgreSQL reserves values atomically so the same value cannot be another person's username or email, including concurrent creation in different sites.

Profile image content is stored in the database. PNG, JPEG and WebP up to 2 MiB are accepted only when the declared MIME type matches the signature. Client filenames and paths are not retained.

## Local password lifecycle

Administrators never choose a user's permanent password. Creation or reset issues a cryptographically random one-time code, displayed once and valid for 30 minutes. Only its SHA-256 hash is stored. Issuing a new code revokes older codes; successful reset invalidates older sessions through the person's security version.

Local passwords are checked against length, context-specific terms and the bundled offline breached/common-password fingerprints. Password hashes use the configured current work factor and are upgraded after successful legacy verification.

Platform Manager controls local login on **Identity**. Keep one local Platform Manager as emergency access until a tested external method preserves administrative access. Direct SSO may hide the ordinary login form and redirect to OIDC or SAML while `/?local=1` remains the documented emergency address. Fylkren refuses to disable local login unless an active Platform Manager is linked to an active external provider that has passed its connection test.

## Authentication pathways and strength

Every successful pathway resolves an active linked internal person, applies the same Site/role authorization after sign-in and creates the same protected Fylkren browser session. Disabling a person, identity or required access blocks all pathways for that person. Local credential-verification routes share the documented anti-automation boundary; provider-side controls remain the provider operator's responsibility.

| Pathway | Proof and assessed strength | Fylkren controls and fallback |
| --- | --- | --- |
| Local password | One local knowledge factor | 14–128 characters, offline common/context-word screening, PBKDF2 hashing, generic failures, rate limit and identity lockout. This is the emergency administrative path while enabled. |
| Local password plus TOTP | Two factors: local password and enrolled TOTP; a single-use recovery code substitutes for the TOTP proof | Five-minute, security-version-bound challenge; replay-resistant time step; one-time recovery codes; shared failure/rate controls. TOTP enrollment and removal require the current password. |
| WebAuthn/passkey | Passwordless public-key authentication with authenticator user verification required | Exact RP/origin binding, five-minute protected state, one-time persisted grant, credential ownership and signature-counter checks. Registration/removal require the current password. Disabled when the common MFA switch or WebAuthn switch is off. |
| Active Directory or LDAP | One directory password factor as observed by Fylkren; the application does not receive a separate directory MFA-strength assertion | Required LDAPS/StartTLS, explicit stable-ID link, end-user bind, generic failure and shared rate limit. Directory-managed people cannot use local password/TOTP/passkey fallback; unavailable directory service fails closed. |
| OIDC authorization code | Provider-authenticated SSO. Fylkren currently treats a successful flow as provider-defined, minimum single-factor strength because it does not require a particular `acr`, `amr` or `auth_time` value. | Exact issuer and linked `(issuer, sub)`, state/correlation/nonce, server-side token handling and signed-token validation. Provider failure does not weaken validation or silently fall back; the separately enabled local emergency path is explicit. Do not use this pathway as application-enforced step-up authentication. |
| SAML 2.0 SP-initiated SSO | Provider-authenticated SSO. Fylkren currently treats a valid assertion as provider-defined, minimum single-factor strength because it does not enforce an authentication-context class. | Exact IdP Entity ID and linked permanent NameID, metadata-backed response/assertion signature, request-state and replay controls. Provider failure does not weaken validation or silently fall back; the separately enabled local emergency path is explicit. Do not use this pathway as application-enforced step-up authentication. |

OIDC/SAML direct redirect changes only which enabled pathway the login page presents first. `/?local=1` selects the separately enabled local pathway; it does not bypass its password, MFA, rate, lockout or session controls. Password-reset codes recover a local credential and do not themselves create a session.

## Platform and site administration

Platform Manager is a system-level account and must not have site membership, unit placement, site role or Site Manager assignment. It appears as a system account in the global directory and cannot be moved or assigned to a site.

The global user directory supports pagination, site filtering and search across name, email, username, provider, external identifier and site. It shows memberships, Site Manager assignments, identity sources and last successful login without exposing operational content.

Without search text, the directory defaults to people without an active site. Platform Manager can bulk assign eligible users, issue individual one-time reset codes to eligible local accounts, transfer an active membership or delete accounts while preserving history.

Transferring a user preserves person ID, identities, profile and historical references. Source-site placement, roles and Site Manager assignment end, active workflow responsibility is released, and the person arrives in the target site without unit or role. The receiving Site Manager then places and authorizes the person.

Deletion ends active access and responsibility, removes email, profile image, passkeys and external links, clears local authentication material and revokes reset codes. A disabled technical identity anchor and locked deleted person remain for security/audit/task/report attribution. Previous username and email become reusable.

Site Manager administers memberships, placements and role assignments in assigned sites. A person transferred in by Platform Manager remains visible under “No active unit” until placed. A receiving Site Manager may add an existing person from another site; the receiving site initiates the action, and each site's placement and roles remain independent.

## External identity

Platform Manager selects **Configure** on the AD, LDAP, OIDC or SAML card under **Identity**, enters the connection values, saves the provider while deactivated, runs **Test saved configuration**, then activates it. Fylkren rejects activation until the current configuration has passed the test. Changes take effect without editing `.env` or restarting containers. Bind passwords and client secrets are encrypted with the persistent Data Protection key ring and are never returned to the browser. Configuration changes and tests are audited.

On the first upgraded startup only, an existing `.env` provider configuration is imported into the protected database settings. The database is authoritative afterwards; later `.env` changes do not overwrite GUI configuration.

External authentication establishes the same local browser session after resolving an explicitly linked internal person:

- OIDC uses authorization code flow and the exact configured issuer plus stable `sub`;
- SAML 2.0 uses SP-initiated Redirect/POST login, metadata-backed response/assertion signature validation and the exact IdP Entity ID plus permanent NameID;
- Active Directory uses `objectGUID`;
- LDAP uses `entryUUID` or the configured stable-ID attribute.

Unknown stable identifiers are rejected. Username is never the permanent link key. Directory search and linking are explicit; AD/LDAP never populate site personnel automatically.

Internal provider destinations and providers with separate OIDC backchannel hosts may require deployment-owned outbound approvals before connection testing. See [outbound integration configuration](../operations/INSTALLATION_AND_UPGRADES.md#outbound-integration-configuration). Invalid or unavailable runtime metadata rejects external sign-in without blocking local administration.

Each external link is visible under its provider card and can be removed there. Removing a link blocks that external sign-in without deleting the internal person, memberships, roles or history; relinking the same provider identity reactivates the retained link. Fylkren refuses to remove the final active external Platform Manager path while local login is disabled. An OIDC `sub` or SAML NameID from a replacement issuer is a different identity even when its text is identical.

AD/LDAP uses encrypted transport, a least-privileged lookup bind and a separate end-user credential bind. User passwords are never stored. Active directory-managed identities synchronize valid name/email attributes at login; local password, TOTP and WebAuthn login are disabled for that person, while the profile image remains locally editable.

Active AD/LDAP links are also checked automatically in the background. The
default interval is 15 minutes. An explicitly disabled AD account or an account
that no longer matches the configured LDAP active-account filter is suspended
after the first authoritative response. A directory entry that is no longer
present must be absent in three successful checks before suspension. Connection,
TLS, bind and ambiguous-result failures never suspend a user. Suspension keeps
the person, memberships, roles and history, but blocks new directory sign-in and
advances the internal security version so existing directory sessions are
rejected on their next request. A later authoritative active result restores the
link without recreating the person. Platform Manager can see each link's state
and last check and can select **Synchronize now** on **Identity**.

AD account status uses `userAccountControl`, `accountExpires` and the configured
active-account filter. Generic LDAP has no universal disabled-account attribute;
the operator must set the **Active-account filter** field to the server's
schema if disabled entries remain searchable. The safe default treats an
existing LDAP entry as active and still detects confirmed deletion by
the configured stable-ID attribute. An ambiguous stable ID, malformed entry,
invalid bind, TLS failure or outage is recorded as unavailable and cannot
trigger suspension.

## MFA and passkeys

Local accounts may enable TOTP from Profile. Activation requires a valid code and displays eight recovery codes once. Login challenges expire after five minutes, and recovery codes are single-use.

`FYLKREN_MFA_ENABLED=false` hides and disables TOTP, passkeys and WebAuthn enforcement while preserving stored configuration for later reactivation. `FYLKREN_WEBAUTHN_ENABLED` is the subordinate WebAuthn switch.

WebAuthn/passkeys require HTTPS except for browser-supported localhost development. Registered credentials are origin/RP-bound, user-named and removable from Profile. Authentication challenges are short-lived and replay-protected, including authenticators without a useful signature counter.

## Membership and roles

Organizational placement gives active members access to their level's Execution workspace but does not create a role. Roles provide planning, leader or work-member capabilities and may be staffed by several people with optional validity dates.

Site Manager can create work roles and grant planner or leader capability within supported permission categories. Critical workflows normally refer to role, unit or level rather than a named person, so absence can be handled through staffing changes without rewriting the task.

Personnel removal deactivates site membership and role assignments without deleting the person's historical identity. Directory-controlled users remain locally managed for site membership, unit and role while their identity attributes and password remain provider-managed.

## Operational scope

- Top-level leaders handle top-level work, task subordinates and receive formal reports/status.
- Leaders act within their own level; explicit deputy authority may add the parent level.
- Planners read level tasks and prepare plans but need leader authority to approve.
- Role members read level tasks and work on assignments to their role/team.
- Active unit members can read and contribute to Execution at their unit; one responsibility lock coordinates editing.
- Parent sites see their cross-site assignments and controlled return information, not child-site internal work.
- Cross-site request senders receive coarse progress and one approved official response only.
- Independent subordinate tasks remain at their owning level and contribute upward only through workload aggregation until an explicit report/approval transition.

Normal/restricted task access controls who may see information. Classification markings describe information and do not grant access.

## Session and security controls

After login, users land on Overview unless a first-password-change flow requires Profile. Browser sessions use inactivity and absolute-lifetime limits and are invalidated by relevant security changes. AD/LDAP sessions revalidate their security version on every request so lifecycle suspension takes effect without the ordinary two-minute session cache. Authenticated mutations require antiforgery validation; external authentication origin, callback and authority configuration is validated at startup.

Identity mapping elevation is justified, time-limited and audited and exposes only the identity data needed for linking. It never grants task, plan, execution or report access.
