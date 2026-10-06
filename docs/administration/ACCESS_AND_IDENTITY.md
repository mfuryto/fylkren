# Access and identity

Local accounts, MFA and WebAuthn/passkeys are Community capabilities. New AD/LDAP, OIDC and SAML identity links and AD/LDAP personnel import require the Enterprise `external-identity` entitlement. If the entitlement expires or is removed, existing linked users can still authenticate and access their authorized data; new linking and import are blocked. See [edition entitlements](../architecture/EDITION_ENTITLEMENTS.md).

The access model is verified end to end against `ACCESS_MATRIX.md`. Person, login identity, site membership, organizational placement and role assignment are separate concepts.

## Person and account

A permanent internal person ID owns historical attribution. One person may have local, Active Directory, LDAP, OIDC or SAML login identities without creating a new historical actor. A normalized primary email address is globally unique and may be used for local login and as a verified mapping candidate; the provider's stable identifier remains the durable external key.

Username and email share one global normalized namespace. PostgreSQL reserves values atomically so the same value cannot be another person's username or email, including concurrent creation in different sites.

Profile image content is stored in the database. PNG, JPEG and WebP up to 2 MiB are accepted only when the declared MIME type matches the signature. Client filenames and paths are not retained.

## Local password lifecycle

Administrators never choose a user's permanent password. Creation or reset issues a cryptographically random one-time code, displayed once and valid for 30 minutes. Only its SHA-256 hash is stored. Issuing a new code revokes older codes; successful reset invalidates older sessions through the person's security version.

Fylkren does not expire local passwords on a schedule or require periodic rotation. A password remains valid until the user changes it, an administrator issues a reset after a recovery or suspected compromise, the account is deactivated/deleted, or an upgraded password hash is written after successful authentication. The temporary first-password-change flag applies only to system-generated bootstrap credentials. Directory-managed password lifetime and compromise policy remain the responsibility of the configured identity provider.

Local passwords are checked against length, context-specific terms and the bundled offline breached/common-password fingerprints. Password hashes use the configured current work factor and are upgraded after successful legacy verification.

Platform Manager controls local login on **Identity**. Keep one local Platform Manager as emergency access until a tested external method preserves administrative access. Direct SSO may hide the ordinary login form and redirect to OIDC or SAML while `/?local=1` remains the documented emergency address. Fylkren refuses to disable local login unless an active Platform Manager is linked to an active external provider that has passed its connection test.

## Authentication pathways and strength

Every successful pathway resolves an active linked internal person and creates the same protected Fylkren browser-session type. Site/role authorization becomes usable only after the mandatory multi-factor boundary is satisfied. Disabling a person, identity or required access blocks all pathways for that person. Local credential-verification routes share the documented anti-automation boundary; provider-side controls remain the provider operator's responsibility.

This table is the complete inventory of interactive human sign-in pathways. First-run Platform Manager creation establishes the initial local account once; password reset changes a credential without creating a session; profile, password and factor changes renew an already authenticated session after reauthentication. Machine API credentials and signed federation messages use separate, non-browser service authentication and cannot create a human browser session.

| Pathway | Proof and assessed strength | Fylkren controls and fallback |
| --- | --- | --- |
| Local password | One local knowledge factor | 14–128 characters, offline common/context-word screening, PBKDF2 hashing, generic failures, rate limit and identity lockout. Produces only restricted enrollment access until TOTP/recovery succeeds. This is the emergency administrative first-factor path while enabled. |
| Local password plus TOTP | Two factors: local password and enrolled TOTP; a single-use recovery code substitutes for the TOTP proof | Five-minute, security-version-bound challenge; replay-resistant time step; one-time recovery codes; shared failure/rate controls. TOTP enrollment and removal require the current password. |
| WebAuthn/passkey | Multi-factor cryptographic authentication: possession of the registered authenticator plus required authenticator user verification | Exact RP/origin binding, five-minute protected state, one-time persisted grant, credential ownership and signature-counter checks. Registration/removal require the current password, and the final factor cannot be removed. Disabled when the common MFA switch or WebAuthn switch is off. |
| Active Directory or LDAP | One directory password factor as observed by Fylkren; the application does not receive a separate directory MFA-strength assertion | Required LDAPS/StartTLS, explicit stable-ID link, end-user bind, generic failure and shared rate limit. Produces only restricted enrollment/completion access until Fylkren TOTP/recovery succeeds; unavailable directory service fails closed. |
| OIDC authorization code | Provider-authenticated SSO treated as minimum single-factor strength because Fylkren does not require a particular `acr` or `amr` value | Exact issuer and linked `(issuer, sub)`, state/correlation/nonce, server-side token handling and signed-token validation. Every challenge requests an explicit provider login and `max_age=300`; signed `auth_time` must be recent. Produces only restricted access until Fylkren TOTP/recovery succeeds. Provider failure does not weaken validation or silently fall back. |
| SAML 2.0 SP-initiated SSO | Provider-authenticated SSO treated as minimum single-factor strength because Fylkren does not enforce an authentication-context class | Exact IdP Entity ID and linked permanent NameID, metadata-backed response/assertion signature, request-state and replay controls. Every request sets `ForceAuthn=true`. Produces only restricted access until Fylkren TOTP/recovery succeeds. Provider failure does not weaken validation or silently fall back. |

OIDC/SAML direct mode changes which enabled pathway the login page presents by itself and requires an explicit user action before the provider challenge starts. `/?local=1` selects the separately enabled local pathway; it does not bypass its password, MFA, rate, lockout or session controls. Password-reset codes recover a local credential and do not themselves create a session.

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

The OIDC provider must sign ID tokens with RS256 using RSA-3072 or stronger. Incoming SAML signatures must use RSA-SHA256 or a stronger recognized signing algorithm and every metadata signing key must be RSA-3072 or stronger. Verify algorithm and key size at the identity provider before activation; weaker keys are rejected.

Unknown stable identifiers are rejected by default. Platform Manager may enable **Create new users at first sign-in** separately for OIDC and SAML. A verified unknown identity then creates one provider-managed person without Site, role or permissions and opens only an information page until Platform Manager assigns a Site. AD/LDAP users are still searched and added explicitly from Personnel; Fylkren never imports an entire directory automatically.

Automatic provisioning never matches an existing person by name, username or email. If one of those values collides with an existing person, sign-in fails safely and **Identity** shows a review item. Platform Manager selects **Prepare link**, enters the existing local username and saves the explicit stable-identifier link. Provider-created name, username, email and stable identifier are read-only in Fylkren; Site membership, placement, roles and permissions remain locally managed.

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

Multi-factor authentication is required by default for every interactive human account. A password, AD/LDAP bind, OIDC response or SAML assertion establishes only a restricted first-factor session. That session can read the minimum configuration and Profile data needed to enroll or complete TOTP, change a mandatory temporary password, or sign out; every operational and administrative API remains blocked. Successful TOTP/recovery verification upgrades it to a full session. User-verifying WebAuthn is an independent multi-factor sign-in pathway.

An unenrolled user is sent directly to the compact TOTP enrollment flow after the first factor. Activation requires a valid code and displays eight recovery codes once. Later login challenges expire after five minutes, and recovery codes are single-use. This same supplemental TOTP boundary applies to local, directory, OIDC and SAML first factors, so Fylkren does not depend on an external provider's undocumented strength claim. Removing the final enrolled multi-factor method is blocked while the policy is required.

`FYLKREN_MFA_REQUIRED=true` is the secure default, not an unconditional installation requirement. A customer may approve a documented exception by setting `FYLKREN_MFA_REQUIRED=false`. Keeping `FYLKREN_MFA_ENABLED=true` then leaves TOTP and passkeys available voluntarily; setting both values to `false` hides and disables the capability without deleting stored credentials. `MFA_ENABLED=false` together with `MFA_REQUIRED=true` is contradictory and deliberately fails startup. Platform Manager marks either exception profile as reduced security under **System status**.

The exception record must identify the accountable customer owner, scope, reason, approval date and review date; describe exposure to stolen, reused or phished credentials and malicious insiders; list compensating controls such as physical and network restriction, identity lifecycle, monitoring and short session limits; and define how mandatory MFA will be restored. Air-gap or an internal network reduces remote exposure but does not by itself provide a second factor. OIDC/SAML MFA at the provider may be a strong compensating control, but Fylkren does not currently elevate those sessions from provider `acr`/`amr` or `AuthnContext` claims; the deployment must not claim conformance with ASVS 6.3.3 solely from an unvalidated provider setting.

WebAuthn/passkeys require HTTPS except for browser-supported localhost development. Registered credentials are origin/RP-bound, user-named and removable from Profile. Authentication challenges are short-lived and replay-protected, including authenticators without a useful signature counter. EC and EdDSA credentials remain supported; an RSA authenticator must produce a key of at least 3072 bits. An older RSA-2048 credential must be replaced from Profile while another factor is available.

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

After login, users land on Overview unless a first-password-change flow requires Profile. Browser sessions use a one-hour sliding inactivity limit and a twelve-hour absolute limit measured from authentication. Activity can renew the inactivity window but preserves the original session-start claim, so it cannot extend the absolute limit. Relevant password, factor, account and sign-out changes advance the security version and invalidate existing sessions. AD/LDAP sessions revalidate their security version on every request so lifecycle suspension takes effect without the ordinary two-minute session cache. Authenticated mutations require antiforgery validation; external authentication origin, callback and authority configuration is validated at startup.

The timing policy uses the [NIST SP 800-63B-4 AAL2 reauthentication limits](https://pages.nist.gov/800-63-4/sp800-63b/aal/) as a conservative session-management reference: the one-hour inactivity limit matches the recommendation and the twelve-hour absolute limit is stricter than the recommended maximum of 24 hours. Mandatory MFA and these timing choices align the supported policy with that reference without representing a third-party assurance or certification.

Fylkren permits multiple concurrent browser sessions for one account and applies no numeric count limit. Authentication therefore never evicts an older session merely because another browser signs in. Each session has an opaque identifier in one authoritative server-side registry, its own inactivity and absolute expiry, bounded browser information and the account security version. Every authenticated request requires an active matching registry record. Expired and revoked records are removed by bounded maintenance after one day.

Profile lists the account's active sessions, identifies the current browser and shows last activity and bounded browser information. A user can terminate one selected session or all active sessions after entering the current local password or within five minutes of a fresh sign-in. An externally authenticated user with an older session repeats external sign-in first. The operation can access only the signed-in account's records and records a security audit event. Explicit sign-out, password change or reset, TOTP/passkey change, account deactivation or deletion retains the stronger account-wide behavior: it advances the security version and invalidates every earlier session at its next request.

### External and federated session boundaries

| System | Session creation and lifetime | Termination and reauthentication boundary |
| --- | --- | --- |
| Fylkren relying party | Local password, TOTP/recovery, WebAuthn, AD/LDAP, OIDC and SAML all create the same protected Fylkren cookie after their own proof succeeds. Fylkren enforces one-hour inactivity, twelve-hour absolute lifetime and the account security version. | Fylkren sign-out and security-version changes revoke Fylkren tickets. Account/access checks run during principal validation. |
| OIDC identity provider | The configured provider owns its upstream session and authentication policy. Every Fylkren authorization-code flow requests `prompt=login` and `max_age=300`. Fylkren requires the signed ID-token `auth_time` to be no more than five minutes old, plus one minute of clock skew. The resulting local session remains restricted until Fylkren TOTP succeeds. | Fylkren sign-out does not call provider logout or back-channel logout. A new full Fylkren session requires both a fresh provider proof and the supplemental local factor. |
| SAML identity provider | The configured provider owns its upstream session and authentication policy. Fylkren sends `ForceAuthn=true` on every SP-initiated request and validates the resulting signed response/assertion. The resulting local session remains restricted until Fylkren TOTP succeeds. | Fylkren implements no SAML Single Logout. A new full Fylkren session requires both a fresh provider proof and the supplemental local factor. |
| AD or LDAP directory | Fylkren performs an end-user bind for every new sign-in and creates a restricted Fylkren first-factor session; there is no upstream browser session. | Full access requires supplemental Fylkren TOTP. Directory lifecycle suspension and account/access/security-version checks invalidate Fylkren access; an unavailable directory fails closed for new sign-in. |

Disabling a provider or unlinking an external identity blocks a new sign-in through that link after configuration takes effect, but does not itself revoke an already issued Fylkren cookie. Administrators must deactivate the account or otherwise advance its security version when immediate termination of existing sessions is required. Provider-coordinated logout remains unsupported; fresh upstream authentication for a later local session is instead enforced on every OIDC and SAML challenge.

Identity mapping elevation is justified, time-limited and audited and exposes only the identity data needed for linking. It never grants task, plan, execution or report access.
